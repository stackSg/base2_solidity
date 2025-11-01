// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./Auction.sol";
import "./PriceOracle.sol";

/**
 * @title AuctionFactory
 * @dev 工厂合约，类似Uniswap V2模式，用于创建和管理拍卖合约实例
 */
contract AuctionFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // 拍卖合约实现地址
    address public auctionImplementation;
    
    // 价格预言机地址
    address public priceOracle;
    
    // 所有创建的拍卖合约地址
    address[] public auctions;
    
    // NFT合约地址 => TokenID => 拍卖合约地址
    mapping(address => mapping(uint256 => address)) public auctionByNFT;
    
    // 卖家地址 => 拍卖合约地址数组
    mapping(address => address[]) public auctionsBySeller;
    
    event AuctionCreated(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId,
        address auctionAddress
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化工厂合约
     */
    function initialize(address _auctionImplementation, address _priceOracle) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        require(_auctionImplementation != address(0), "Invalid implementation");
        require(_priceOracle != address(0), "Invalid price oracle");
        
        auctionImplementation = _auctionImplementation;
        priceOracle = _priceOracle;
    }

    /**
     * @dev 创建新的拍卖
     */
    function createAuction(
        address nftContract,
        uint256 tokenId,
        address acceptedToken, // address(0) for ETH
        uint256 startTime,
        uint256 endTime,
        uint256 minBid
    ) external returns (address) {
        require(nftContract != address(0), "Invalid NFT contract");
        require(auctionByNFT[nftContract][tokenId] == address(0), "Auction already exists");
        require(endTime > startTime, "Invalid time range");
        require(endTime > block.timestamp, "End time must be in the future");

        // 创建代理合约
        bytes memory initData = abi.encodeWithSelector(
            Auction.initialize.selector,
            msg.sender,        // seller
            nftContract,       // nftContract
            tokenId,           // tokenId
            acceptedToken,     // acceptedToken
            startTime,         // startTime
            endTime,           // endTime
            minBid,            // minBid
            priceOracle        // priceOracle
        );

        ERC1967Proxy proxy = new ERC1967Proxy(auctionImplementation, initData);
        address auctionAddress = address(proxy);

        // 记录拍卖信息
        auctions.push(auctionAddress);
        auctionByNFT[nftContract][tokenId] = auctionAddress;
        auctionsBySeller[msg.sender].push(auctionAddress);

        emit AuctionCreated(msg.sender, nftContract, tokenId, auctionAddress);

        return auctionAddress;
    }

    /**
     * @dev 获取拍卖总数
     */
    function getAuctionCount() external view returns (uint256) {
        return auctions.length;
    }

    /**
     * @dev 获取卖家的所有拍卖
     */
    function getAuctionsBySeller(address seller) external view returns (address[] memory) {
        return auctionsBySeller[seller];
    }

    /**
     * @dev 获取所有拍卖地址
     */
    function getAllAuctions() external view returns (address[] memory) {
        return auctions;
    }

    /**
     * @dev 更新拍卖实现合约地址
     */
    function setAuctionImplementation(address _implementation) external onlyOwner {
        require(_implementation != address(0), "Invalid implementation");
        auctionImplementation = _implementation;
    }

    /**
     * @dev 更新价格预言机地址
     */
    function setPriceOracle(address _priceOracle) external onlyOwner {
        require(_priceOracle != address(0), "Invalid price oracle");
        priceOracle = _priceOracle;
    }

    /**
     * @dev UUPS升级授权
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
