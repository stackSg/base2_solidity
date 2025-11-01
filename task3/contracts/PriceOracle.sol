// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title PriceOracle
 * @dev 使用 Chainlink 价格预言机获取 ERC20 和 ETH 到美元的价格
 */
contract PriceOracle is Initializable, OwnableUpgradeable {
    // ETH/USD 价格聚合器
    AggregatorV3Interface public ethUsdPriceFeed;
    
    // ERC20 代币地址 => 价格聚合器地址
    mapping(address => address) public tokenPriceFeeds;
    
    event PriceFeedUpdated(address indexed token, address indexed priceFeed);

    /**
     * @dev 初始化合约
     */
    function initialize(address _ethUsdPriceFeed) public initializer {
        __Ownable_init(msg.sender);
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
    }

    /**
     * @dev 设置 ERC20 代币的价格聚合器
     */
    function setTokenPriceFeed(address token, address priceFeed) external onlyOwner {
        tokenPriceFeeds[token] = priceFeed;
        emit PriceFeedUpdated(token, priceFeed);
    }

    /**
     * @dev 获取 ETH 的美元价格（带8位小数）
     */
    function getEthPrice() public view returns (uint256) {
        (, int256 price, , , ) = ethUsdPriceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price);
    }

    /**
     * @dev 获取 ERC20 代币的美元价格（带8位小数）
     */
    function getTokenPrice(address token) public view returns (uint256) {
        address priceFeedAddress = tokenPriceFeeds[token];
        require(priceFeedAddress != address(0), "Price feed not set");
        AggregatorV3Interface priceFeed = AggregatorV3Interface(priceFeedAddress);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price);
    }

    /**
     * @dev 将 ETH 金额转换为美元（18位小数）
     */
    function convertEthToUsd(uint256 ethAmount) public view returns (uint256) {
        uint256 ethPrice = getEthPrice(); // 8 decimals
        // ethAmount: 18 decimals, ethPrice: 8 decimals
        // result: 18 decimals
        return (ethAmount * ethPrice) / 1e8;
    }

    /**
     * @dev 将 ERC20 代币金额转换为美元（18位小数）
     */
    function convertTokenToUsd(address token, uint256 tokenAmount) public view returns (uint256) {
        uint256 tokenPrice = getTokenPrice(token); // 8 decimals
        // tokenAmount: 18 decimals (assuming standard ERC20), tokenPrice: 8 decimals
        // result: 18 decimals
        return (tokenAmount * tokenPrice) / 1e8;
    }

    /**
     * @dev 比较两个出价的美元价值
     * @return -1 if bid1 < bid2, 0 if equal, 1 if bid1 > bid2
     */
    function compareBids(
        bool bid1IsEth,
        address bid1Token,
        uint256 bid1Amount,
        bool bid2IsEth,
        address bid2Token,
        uint256 bid2Amount
    ) external view returns (int256) {
        uint256 bid1Usd = bid1IsEth 
            ? convertEthToUsd(bid1Amount)
            : convertTokenToUsd(bid1Token, bid1Amount);
        
        uint256 bid2Usd = bid2IsEth
            ? convertEthToUsd(bid2Amount)
            : convertTokenToUsd(bid2Token, bid2Amount);

        if (bid1Usd < bid2Usd) return -1;
        if (bid1Usd > bid2Usd) return 1;
        return 0;
    }
}
