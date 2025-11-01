// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockPriceFeed
 * @dev 用于测试的模拟价格聚合器
 */
contract MockPriceFeed is AggregatorV3Interface {
    uint8 public constant decimals = 8;
    string public description = "Mock Price Feed";
    uint256 public version = 1;
    
    int256 private _price;
    uint256 private _updatedAt;
    uint80 private _roundId;

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (uint80(_roundId), _price, block.timestamp - 1 hours, _updatedAt, uint80(_roundId));
    }

    function setPrice(int256 price) external {
        _price = price;
        _updatedAt = block.timestamp;
        _roundId++;
    }

    function getRoundData(uint80 /* roundId */)
        external
        pure
        override
        returns (
            uint80 /* roundId */,
            int256 /* answer */,
            uint256 /* startedAt */,
            uint256 /* updatedAt */,
            uint80 /* answeredInRound */
        )
    {
        revert("Not implemented");
    }
}
