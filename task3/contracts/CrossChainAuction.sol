// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./PriceOracle.sol";
import "./Auction.sol";

/**
 * @title CrossChainAuction
 * @dev 支持跨链拍卖的合约接口
 * 
 * 注意：完整的CCIP集成需要安装 chainlink/contracts-ccip 包
 * 并实现 Chainlink CCIP 的消息传递。
 * 
 * 这是一个简化版本，展示了跨链拍卖的数据结构。
 * 在实际部署中，需要：
 * 1. 安装 chainlink/contracts-ccip 包
 * 2. 配置 CCIP Router 地址
 * 3. 实现完整的消息传递逻辑
 */
contract CrossChainAuction is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    struct CrossChainBid {
        uint64 sourceChainSelector;
        address bidder;
        uint256 amount;
        address token; // address(0) for native token
        bool isEth;
        uint256 timestamp;
        bool processed;
    }

    // 跨链出价ID => 跨链出价信息
    mapping(bytes32 => CrossChainBid) public crossChainBids;
    
    // 目标链选择器
    uint64 public targetChainSelector;
    
    // 目标链上的拍卖合约地址
    address public targetAuctionAddress;
    
    // 跨链消息计数器
    uint256 private messageCounter;
    
    // 消息ID => 跨链出价ID
    mapping(bytes32 => bytes32) public messageToBid;

    event CrossChainBidSent(
        bytes32 indexed bidId,
        uint64 indexed destinationChain,
        address indexed bidder,
        uint256 amount,
        address token
    );

    event CrossChainBidReceived(
        bytes32 indexed bidId,
        uint64 indexed sourceChain,
        address indexed bidder,
        uint256 amount,
        address token
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化跨链拍卖合约
     * @param _targetChainSelector 目标链选择器
     * @param _targetAuctionAddress 目标链上的拍卖合约地址
     * @param _owner 合约所有者
     */
    function initialize(
        address, // _ccipRouter - 保留用于未来CCIP集成
        uint64 _targetChainSelector,
        address _targetAuctionAddress,
        address _owner
    ) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        targetChainSelector = _targetChainSelector;
        targetAuctionAddress = _targetAuctionAddress;
        // 注意：如果需要使用CCIP，需要继承CCIPReceiver并调用__CCIPReceiver_init(_ccipRouter)
    }

    /**
     * @dev 发送跨链出价
     * @param destinationChainSelector 目标链选择器
     * @param amount 出价金额
     * @param token 代币地址（ETH时为address(0)）
     * @param isEth 是否为ETH出价
     */
    function sendCrossChainBid(
        uint64 destinationChainSelector,
        address, // destinationAuction - 保留用于未来CCIP集成
        uint256 amount,
        address token,
        bool isEth
    ) external payable nonReentrant returns (bytes32) {
        if (isEth) {
            require(msg.value >= amount, "Insufficient ETH");
        } else {
            require(token != address(0), "Invalid token");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        bytes32 bidId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            messageCounter++,
            amount
        ));

        // TODO: 实现 Chainlink CCIP 消息发送
        // 需要安装 @chainlink/contracts-ccip 包
        // 示例代码：
        // Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
        //     receiver: abi.encode(destinationAuction),
        //     data: abi.encodeWithSignature(
        //         "receiveCrossChainBid(uint64,address,uint256,address,bool)",
        //         block.chainid,
        //         msg.sender,
        //         amount,
        //         token,
        //         isEth
        //     ),
        //     tokenAmounts: new Client.EVMTokenAmount[](0),
        //     extraArgs: "",
        //     feeToken: address(0)
        // });
        // uint256 fee = IRouterClient(ccipRouter).getFee(destinationChainSelector, message);
        // require(msg.value >= fee + (isEth ? amount : 0), "Insufficient fee");

        crossChainBids[bidId] = CrossChainBid({
            sourceChainSelector: uint64(block.chainid),
            bidder: msg.sender,
            amount: amount,
            token: token,
            isEth: isEth,
            timestamp: block.timestamp,
            processed: false
        });

        emit CrossChainBidSent(bidId, destinationChainSelector, msg.sender, amount, token);

        return bidId;
    }

    /**
     * @dev 接收跨链出价（需要实现CCIP接收逻辑）
     * 
     * TODO: 实现 Chainlink CCIP 消息接收
     * 如果使用CCIP，需要：
     * 1. 继承 CCIPReceiver 合约
     * 2. 实现 _ccipReceive 函数
     * 3. 配置 CCIP Router 地址
     * 
     * 示例：
     * function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
     *     bytes32 messageId = message.messageId;
     *     (uint64 sourceChain, address bidder, uint256 amount, address token, bool isEth) = 
     *         abi.decode(message.data, (uint64, address, uint256, address, bool));
     *     // 处理跨链出价...
     * }
     */
    
    /**
     * @dev 手动接收跨链出价（用于测试或非CCIP场景）
     */
    function receiveCrossChainBid(
        uint64 sourceChain,
        address bidder,
        uint256 amount,
        address token,
        bool isEth
    ) external onlyOwner {
        bytes32 bidId = keccak256(abi.encodePacked(
            bidder,
            sourceChain,
            block.timestamp,
            amount
        ));

        crossChainBids[bidId] = CrossChainBid({
            sourceChainSelector: sourceChain,
            bidder: bidder,
            amount: amount,
            token: token,
            isEth: isEth,
            timestamp: block.timestamp,
            processed: false
        });

        emit CrossChainBidReceived(bidId, sourceChain, bidder, amount, token);
    }

    /**
     * @dev 处理跨链出价并提交到拍卖合约
     */
    function processCrossChainBid(bytes32 bidId) external nonReentrant {
        CrossChainBid memory bid = crossChainBids[bidId];
        require(!bid.processed, "Bid already processed");
        require(targetAuctionAddress != address(0), "Target auction not set");

        crossChainBids[bidId].processed = true;

        // 调用目标拍卖合约的出价函数
        if (bid.isEth) {
            Auction(targetAuctionAddress).bidEth{value: bid.amount}();
        } else {
            IERC20(bid.token).approve(targetAuctionAddress, bid.amount);
            Auction(targetAuctionAddress).bidToken(bid.amount);
        }
    }

    /**
     * @dev 设置目标拍卖地址
     */
    function setTargetAuction(address _targetAuction) external onlyOwner {
        targetAuctionAddress = _targetAuction;
    }

    /**
     * @dev 设置目标链选择器
     */
    function setTargetChainSelector(uint64 _selector) external onlyOwner {
        targetChainSelector = _selector;
    }

    /**
     * @dev UUPS升级授权
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev 接收ETH
     */
    receive() external payable {}
}
