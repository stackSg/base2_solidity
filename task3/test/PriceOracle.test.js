const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("PriceOracle", function () {
  let priceOracle;
  let mockEthPriceFeed, mockTokenPriceFeed;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // 部署模拟价格聚合器
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockEthPriceFeed = await MockPriceFeed.deploy();
    await mockEthPriceFeed.waitForDeployment();

    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await upgrades.deployProxy(
      PriceOracle,
      [await mockEthPriceFeed.getAddress()],
      { initializer: "initialize" }
    );
    await priceOracle.waitForDeployment();
  });

  describe("ETH价格", function () {
    it("应该返回ETH价格", async function () {
      // Mock价格设置为 $3000 (3000 * 10^8)
      await mockEthPriceFeed.setPrice(3000 * 10 ** 8);
      const price = await priceOracle.getEthPrice();
      expect(price).to.equal(3000 * 10 ** 8);
    });

    it("应该将ETH转换为USD", async function () {
      await mockEthPriceFeed.setPrice(3000 * 10 ** 8);
      const usdValue = await priceOracle.convertEthToUsd(
        ethers.parseEther("1") // 1 ETH
      );
      // 1 ETH * $3000 = $3000 (18 decimals)
      expect(usdValue).to.equal(ethers.parseEther("3000"));
    });
  });

  describe("ERC20代币价格", function () {
    let mockToken;

    beforeEach(async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockToken = await MockERC20.deploy("Test Token", "TT");
      await mockToken.waitForDeployment();

      const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      mockTokenPriceFeed = await MockPriceFeed.deploy();
      await mockTokenPriceFeed.waitForDeployment();

      await mockTokenPriceFeed.setPrice(2 * 10 ** 8); // $2 per token
      await priceOracle.setTokenPriceFeed(
        await mockToken.getAddress(),
        await mockTokenPriceFeed.getAddress()
      );
    });

    it("应该返回代币价格", async function () {
      const price = await priceOracle.getTokenPrice(await mockToken.getAddress());
      expect(price).to.equal(2 * 10 ** 8);
    });

    it("应该将代币转换为USD", async function () {
      const usdValue = await priceOracle.convertTokenToUsd(
        await mockToken.getAddress(),
        ethers.parseEther("100") // 100 tokens
      );
      // 100 tokens * $2 = $200 (18 decimals)
      expect(usdValue).to.equal(ethers.parseEther("200"));
    });
  });

  describe("出价比较", function () {
    let mockToken;

    beforeEach(async function () {
      await mockEthPriceFeed.setPrice(3000 * 10 ** 8); // ETH = $3000

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockToken = await MockERC20.deploy("Test Token", "TT");
      await mockToken.waitForDeployment();

      const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      mockTokenPriceFeed = await MockPriceFeed.deploy();
      await mockTokenPriceFeed.waitForDeployment();
      await mockTokenPriceFeed.setPrice(2 * 10 ** 8); // Token = $2
      await priceOracle.setTokenPriceFeed(
        await mockToken.getAddress(),
        await mockTokenPriceFeed.getAddress()
      );
    });

    it("应该正确比较两个ETH出价", async function () {
      const result = await priceOracle.compareBids(
        true, // bid1 is ETH
        ethers.ZeroAddress,
        ethers.parseEther("1"), // 1 ETH = $3000
        true, // bid2 is ETH
        ethers.ZeroAddress,
        ethers.parseEther("2") // 2 ETH = $6000
      );
      expect(result).to.equal(-1); // bid1 < bid2
    });

    it("应该正确比较ETH和ERC20出价", async function () {
      // 1 ETH ($3000) vs 1500 tokens (1500 * $2 = $3000)
      const result = await priceOracle.compareBids(
        true,
        ethers.ZeroAddress,
        ethers.parseEther("1"),
        false,
        await mockToken.getAddress(),
        ethers.parseEther("1500")
      );
      expect(result).to.equal(0); // Equal
    });
  });
});

// Mock Price Feed合约用于测试
async function deployMockPriceFeed(hre) {
  const MockPriceFeed = await hre.ethers.getContractFactory("MockPriceFeed");
  return await MockPriceFeed.deploy();
}
