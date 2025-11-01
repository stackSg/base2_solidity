const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Auction", function () {
  let auction, auctionImplementation;
  let nftMarketplace, priceOracle, mockERC20;
  let mockEthPriceFeed, mockTokenPriceFeed;
  let owner, seller, bidder1, bidder2;

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2] = await ethers.getSigners();

    // 部署NFT合约
    const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
    nftMarketplace = await NFTMarketplace.deploy(
      "Test NFT",
      "TNFT",
      "https://example.com/api/token/"
    );
    await nftMarketplace.waitForDeployment();

    // 部署价格预言机
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockEthPriceFeed = await MockPriceFeed.deploy();
    await mockEthPriceFeed.waitForDeployment();
    await mockEthPriceFeed.setPrice(3000 * 10 ** 8); // ETH = $3000

    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await upgrades.deployProxy(
      PriceOracle,
      [await mockEthPriceFeed.getAddress()],
      { initializer: "initialize" }
    );
    await priceOracle.waitForDeployment();

    // 部署ERC20代币
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("Test Token", "TT");
    await mockERC20.waitForDeployment();

    // 设置代币价格
    mockTokenPriceFeed = await MockPriceFeed.deploy();
    await mockTokenPriceFeed.waitForDeployment();
    await mockTokenPriceFeed.setPrice(2 * 10 ** 8); // Token = $2
    await priceOracle.setTokenPriceFeed(
      await mockERC20.getAddress(),
      await mockTokenPriceFeed.getAddress()
    );

    // 铸造NFT给卖家
    await nftMarketplace.mint(seller.address);

    // 部署拍卖实现合约
    const Auction = await ethers.getContractFactory("Auction");
    auctionImplementation = await Auction.deploy();
    await auctionImplementation.waitForDeployment();
  });

  describe("ETH拍卖", function () {
    let startTime, endTime;

    beforeEach(async function () {
      startTime = await time.latest() + 100;
      endTime = startTime + 3600; // 1小时后结束

      // 卖家批准NFT转移
      await nftMarketplace.connect(seller).approve(
        await auctionImplementation.getAddress(),
        1
      );
    });

    it("应该创建ETH拍卖", async function () {
      const { proxy } = await deployAuctionProxy(
        seller,
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress, // ETH
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      const [auctionData] = await proxy.getAuctionInfo();
      expect(auctionData.seller).to.equal(seller.address);
      expect(auctionData.acceptedToken).to.equal(ethers.ZeroAddress);
      expect(auctionData.isActive).to.be.true;
    });

    it("应该允许ETH出价", async function () {
      const { proxy } = await deployAuctionProxy(
        seller,
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      await time.increaseTo(startTime + 10);

      await expect(
        proxy.connect(bidder1).bidEth({ value: ethers.parseEther("1") })
      )
        .to.emit(proxy, "BidPlaced")
        .withArgs(bidder1.address, ethers.parseEther("1"), ethers.ZeroAddress, true, anyValue);

      const [, highestBid] = await proxy.getAuctionInfo();
      expect(highestBid.bidder).to.equal(bidder1.address);
    });

    it("应该拒绝低于最小出价的投标", async function () {
      const { proxy } = await deployAuctionProxy(
        seller,
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("1")
      );

      await time.increaseTo(startTime + 10);

      await expect(
        proxy.connect(bidder1).bidEth({ value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Bid too low");
    });

    it("应该拒绝低于当前最高出价的投标", async function () {
      const { proxy } = await deployAuctionProxy(
        seller,
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      await time.increaseTo(startTime + 10);

      await proxy.connect(bidder1).bidEth({ value: ethers.parseEther("1") });
      
      await expect(
        proxy.connect(bidder2).bidEth({ value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Bid must be higher");

      // 更高的出价应该成功
      await proxy.connect(bidder2).bidEth({ value: ethers.parseEther("2") });
      
      const [, highestBid] = await proxy.getAuctionInfo();
      expect(highestBid.bidder).to.equal(bidder2.address);
    });

    it("应该退还之前的出价", async function () {
      const { proxy } = await deployAuctionProxy(
        seller,
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      await time.increaseTo(startTime + 10);

      await proxy.connect(bidder1).bidEth({ value: ethers.parseEther("1") });
      await proxy.connect(bidder2).bidEth({ value: ethers.parseEther("2") });

      // bidder1可以撤回之前的出价
      const balanceBefore = await ethers.provider.getBalance(bidder1.address);
      const tx = await proxy.connect(bidder1).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(bidder1.address);

      expect(balanceAfter + gasUsed).to.be.closeTo(
        balanceBefore + ethers.parseEther("1"),
        ethers.parseEther("0.01")
      );
    });

    it("应该结束拍卖并转移NFT和资金", async function () {
      const { proxy } = await deployAuctionProxy(
        seller,
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      await time.increaseTo(startTime + 10);
      await proxy.connect(bidder1).bidEth({ value: ethers.parseEther("1") });

      await time.increaseTo(endTime + 10);

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      await proxy.endAuction();
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);

      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(ethers.parseEther("1"));
      expect(await nftMarketplace.ownerOf(1)).to.equal(bidder1.address);

      const [auctionData] = await proxy.getAuctionInfo();
      expect(auctionData.isEnded).to.be.true;
    });
  });

  describe("ERC20拍卖", function () {
    let startTime, endTime;

    beforeEach(async function () {
      startTime = await time.latest() + 100;
      endTime = startTime + 3600;

      await nftMarketplace.connect(seller).approve(
        await auctionImplementation.getAddress(),
        1
      );

      // 给竞标者代币
      await mockERC20.mint(bidder1.address, ethers.parseEther("10000"));
      await mockERC20.mint(bidder2.address, ethers.parseEther("10000"));
    });

    it("应该允许ERC20出价", async function () {
      const { proxy } = await deployAuctionProxy(
        seller,
        await nftMarketplace.getAddress(),
        1,
        await mockERC20.getAddress(),
        startTime,
        endTime,
        ethers.parseEther("100")
      );

      await time.increaseTo(startTime + 10);

      await mockERC20.connect(bidder1).approve(await proxy.getAddress(), ethers.parseEther("1000"));
      
      await expect(
        proxy.connect(bidder1).bidToken(ethers.parseEther("1000"))
      )
        .to.emit(proxy, "BidPlaced")
        .withArgs(bidder1.address, ethers.parseEther("1000"), await mockERC20.getAddress(), false, anyValue);
    });

    it("应该结束ERC20拍卖", async function () {
      const { proxy } = await deployAuctionProxy(
        seller,
        await nftMarketplace.getAddress(),
        1,
        await mockERC20.getAddress(),
        startTime,
        endTime,
        ethers.parseEther("100")
      );

      await time.increaseTo(startTime + 10);
      
      await mockERC20.connect(bidder1).approve(await proxy.getAddress(), ethers.parseEther("1000"));
      await proxy.connect(bidder1).bidToken(ethers.parseEther("1000"));

      await time.increaseTo(endTime + 10);
      await proxy.endAuction();

      expect(await nftMarketplace.ownerOf(1)).to.equal(bidder1.address);
      expect(await mockERC20.balanceOf(seller.address)).to.equal(ethers.parseEther("1000"));
    });
  });

  async function deployAuctionProxy(
    sellerSigner,
    nftContract,
    tokenId,
    acceptedToken,
    startTime,
    endTime,
    minBid
  ) {
    const Auction = await ethers.getContractFactory("Auction");
    const proxy = await upgrades.deployProxy(
      Auction,
      [
        sellerSigner.address,
        nftContract,
        tokenId,
        acceptedToken,
        startTime,
        endTime,
        minBid,
        await priceOracle.getAddress(),
      ],
      { initializer: "initialize" }
    );
    await proxy.waitForDeployment();
    return { proxy };
  }
});

const anyValue = () => true;
