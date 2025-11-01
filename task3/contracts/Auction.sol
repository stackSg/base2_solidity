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

/**
 * @title Auction
 * @dev NFT拍卖合约，支持ETH和ERC20出价，使用UUPS可升级
 */
contract Auction is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    struct Bid {
        address bidder;
        uint256 amount;
        address token; // address(0) for ETH
        bool isEth;
        uint256 timestamp;
    }

    struct AuctionData {
        address seller;
        address nftContract;
        uint256 tokenId;
        address acceptedToken; // address(0) for ETH, or ERC20 address
        uint256 startTime;
        uint256 endTime;
        uint256 minBid;
        bool isActive;
        bool isEnded;
    }

    AuctionData public auction;
    Bid public highestBid;
    address public priceOracle;

    // 映射：出价者 => 出价金额（用于退款）
    mapping(address => Bid) public pendingReturns;
    mapping(address => mapping(address => uint256)) public tokenPendingReturns; // token => bidder => amount

    event AuctionCreated(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 startTime,
        uint256 endTime,
        uint256 minBid
    );

    event BidPlaced(
        address indexed bidder,
        uint256 amount,
        address token,
        bool isEth,
        uint256 timestamp
    );

    event BidRefunded(address indexed bidder, uint256 amount, address token, bool isEth);

    event AuctionEnded(
        address indexed winner,
        uint256 amount,
        address token,
        bool isEth
    );

    event AuctionCancelled(address indexed seller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化拍卖合约
     */
    function initialize(
        address _seller,
        address _nftContract,
        uint256 _tokenId,
        address _acceptedToken, // address(0) for ETH
        uint256 _startTime,
        uint256 _endTime,
        uint256 _minBid,
        address _priceOracle
    ) public initializer {
        __Ownable_init(_seller);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_endTime > _startTime, "Invalid time range");
        require(_endTime > block.timestamp, "End time must be in the future");
        require(_priceOracle != address(0), "Invalid price oracle");

        // 检查NFT是否属于卖家
        IERC721 nft = IERC721(_nftContract);
        require(nft.ownerOf(_tokenId) == _seller, "Seller does not own NFT");
        
        // 转移NFT到拍卖合约
        nft.safeTransferFrom(_seller, address(this), _tokenId);

        auction = AuctionData({
            seller: _seller,
            nftContract: _nftContract,
            tokenId: _tokenId,
            acceptedToken: _acceptedToken,
            startTime: _startTime,
            endTime: _endTime,
            minBid: _minBid,
            isActive: true,
            isEnded: false
        });

        priceOracle = _priceOracle;

        emit AuctionCreated(
            _seller,
            _nftContract,
            _tokenId,
            _startTime,
            _endTime,
            _minBid
        );
    }

    /**
     * @dev 使用ETH出价
     */
    function bidEth() external payable nonReentrant {
        require(auction.isActive, "Auction not active");
        require(!auction.isEnded, "Auction ended");
        require(block.timestamp >= auction.startTime, "Auction not started");
        require(block.timestamp <= auction.endTime, "Auction ended");
        require(auction.acceptedToken == address(0), "This auction accepts ERC20 tokens");
        require(msg.value >= auction.minBid, "Bid too low");

        // 检查是否超过当前最高出价
        if (highestBid.bidder != address(0)) {
            require(msg.value > highestBid.amount, "Bid must be higher");
            
            // 退还之前的最高出价
            if (highestBid.isEth) {
                pendingReturns[highestBid.bidder].amount += highestBid.amount;
                pendingReturns[highestBid.bidder].isEth = true;
            } else {
                tokenPendingReturns[highestBid.token][highestBid.bidder] += highestBid.amount;
            }
        }

        highestBid = Bid({
            bidder: msg.sender,
            amount: msg.value,
            token: address(0),
            isEth: true,
            timestamp: block.timestamp
        });

        emit BidPlaced(msg.sender, msg.value, address(0), true, block.timestamp);
    }

    /**
     * @dev 使用ERC20代币出价
     */
    function bidToken(uint256 amount) external nonReentrant {
        require(auction.isActive, "Auction not active");
        require(!auction.isEnded, "Auction ended");
        require(block.timestamp >= auction.startTime, "Auction not started");
        require(block.timestamp <= auction.endTime, "Auction ended");
        require(auction.acceptedToken != address(0), "This auction accepts ETH");
        require(amount >= auction.minBid, "Bid too low");

        IERC20 token = IERC20(auction.acceptedToken);
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // 检查是否超过当前最高出价
        if (highestBid.bidder != address(0)) {
            bool isHigher = compareBids(
                false,
                auction.acceptedToken,
                amount,
                highestBid.isEth,
                highestBid.token,
                highestBid.amount
            );
            require(isHigher, "Bid must be higher in USD value");
            
            // 退还之前的最高出价
            if (highestBid.isEth) {
                pendingReturns[highestBid.bidder].amount += highestBid.amount;
                pendingReturns[highestBid.bidder].isEth = true;
            } else {
                tokenPendingReturns[highestBid.token][highestBid.bidder] += highestBid.amount;
            }
        }

        token.safeTransferFrom(msg.sender, address(this), amount);

        highestBid = Bid({
            bidder: msg.sender,
            amount: amount,
            token: auction.acceptedToken,
            isEth: false,
            timestamp: block.timestamp
        });

        emit BidPlaced(msg.sender, amount, auction.acceptedToken, false, block.timestamp);
    }

    /**
     * @dev 比较两个出价（使用价格预言机）
     */
    function compareBids(
        bool bid1IsEth,
        address bid1Token,
        uint256 bid1Amount,
        bool bid2IsEth,
        address bid2Token,
        uint256 bid2Amount
    ) internal view returns (bool) {
        PriceOracle oracle = PriceOracle(priceOracle);
        int256 result = oracle.compareBids(
            bid1IsEth,
            bid1Token,
            bid1Amount,
            bid2IsEth,
            bid2Token,
            bid2Amount
        );
        return result > 0;
    }

    /**
     * @dev 结束拍卖
     */
    function endAuction() external nonReentrant {
        require(auction.isActive, "Auction not active");
        require(!auction.isEnded, "Auction already ended");
        require(
            block.timestamp >= auction.endTime || msg.sender == owner(),
            "Auction not ended"
        );

        auction.isActive = false;
        auction.isEnded = true;

        IERC721 nft = IERC721(auction.nftContract);

        if (highestBid.bidder != address(0)) {
            // 转移NFT给最高出价者
            nft.safeTransferFrom(address(this), highestBid.bidder, auction.tokenId);

            // 转移资金给卖家
            if (highestBid.isEth) {
                payable(auction.seller).transfer(highestBid.amount);
            } else {
                IERC20 token = IERC20(highestBid.token);
                token.safeTransfer(auction.seller, highestBid.amount);
            }

            emit AuctionEnded(
                highestBid.bidder,
                highestBid.amount,
                highestBid.token,
                highestBid.isEth
            );
        } else {
            // 没有出价，退还NFT给卖家
            nft.safeTransferFrom(address(this), auction.seller, auction.tokenId);
            emit AuctionEnded(address(0), 0, address(0), false);
        }
    }

    /**
     * @dev 撤回未中标的出价
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender].amount;
        if (amount > 0 && pendingReturns[msg.sender].isEth) {
            pendingReturns[msg.sender].amount = 0;
            payable(msg.sender).transfer(amount);
            emit BidRefunded(msg.sender, amount, address(0), true);
        }
    }

    /**
     * @dev 撤回未中标的ERC20出价
     */
    function withdrawToken(address token) external nonReentrant {
        uint256 amount = tokenPendingReturns[token][msg.sender];
        if (amount > 0) {
            tokenPendingReturns[token][msg.sender] = 0;
            IERC20(token).safeTransfer(msg.sender, amount);
            emit BidRefunded(msg.sender, amount, token, false);
        }
    }

    /**
     * @dev 取消拍卖（仅卖家）
     */
    function cancelAuction() external {
        require(msg.sender == auction.seller, "Only seller can cancel");
        require(!auction.isEnded, "Auction already ended");

        auction.isActive = false;
        auction.isEnded = true;

        IERC721 nft = IERC721(auction.nftContract);
        nft.safeTransferFrom(address(this), auction.seller, auction.tokenId);

        // 退还所有出价
        if (highestBid.bidder != address(0)) {
            if (highestBid.isEth) {
                payable(highestBid.bidder).transfer(highestBid.amount);
            } else {
                IERC20 token = IERC20(highestBid.token);
                token.safeTransfer(highestBid.bidder, highestBid.amount);
            }
        }

        emit AuctionCancelled(auction.seller);
    }

    /**
     * @dev 获取拍卖信息
     */
    function getAuctionInfo() external view returns (AuctionData memory, Bid memory) {
        return (auction, highestBid);
    }

    /**
     * @dev UUPS升级授权
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
