const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AuctionFactory", function () {
  let factory, factoryImplementation;
  let auctionImplementation;
  let nftMarketplace, priceOracle, mockERC20;
  let mockEthPriceFeed;
  let owner, seller;

  beforeEach(async function () {
    [owner, seller] = await ethers.getSigners();

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
    await mockEthPriceFeed.setPrice(3000 * 10 ** 8);

    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await upgrades.deployProxy(
      PriceOracle,
      [await mockEthPriceFeed.getAddress()],
      { initializer: "initialize" }
    );
    await priceOracle.waitForDeployment();

    // 部署ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("Test Token", "TT");
    await mockERC20.waitForDeployment();

    // 部署拍卖实现合约
    const Auction = await ethers.getContractFactory("Auction");
    auctionImplementation = await Auction.deploy();
    await auctionImplementation.waitForDeployment();

    // 部署工厂合约
    const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
    factoryImplementation = await AuctionFactory.deploy();
    await factoryImplementation.waitForDeployment();

    factory = await upgrades.deployProxy(
      AuctionFactory,
      [
        await auctionImplementation.getAddress(),
        await priceOracle.getAddress(),
      ],
      { initializer: "initialize" }
    );
    await factory.waitForDeployment();
  });

  describe("创建拍卖", function () {
    it("应该通过工厂创建拍卖", async function () {
      await nftMarketplace.mint(seller.address);
      await nftMarketplace.connect(seller).approve(
        await factory.getAddress(),
        1
      );

      const startTime = await time.latest() + 100;
      const endTime = startTime + 3600;

      await expect(
        factory.connect(seller).createAuction(
          await nftMarketplace.getAddress(),
          1,
          ethers.ZeroAddress, // ETH
          startTime,
          endTime,
          ethers.parseEther("0.1")
        )
      )
        .to.emit(factory, "AuctionCreated")
        .withArgs(
          seller.address,
          await nftMarketplace.getAddress(),
          1,
          anyValue
        );

      expect(await factory.getAuctionCount()).to.equal(1);
    });

    it("应该正确记录拍卖地址", async function () {
      await nftMarketplace.mint(seller.address);
      await nftMarketplace.connect(seller).approve(
        await factory.getAddress(),
        1
      );

      const startTime = await time.latest() + 100;
      const endTime = startTime + 3600;

      const tx = await factory.connect(seller).createAuction(
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      const receipt = await tx.wait();
      const auctionCreatedEvent = receipt.logs.find(
        log => log.topics[0] === factory.interface.getEvent("AuctionCreated").topicHash
      );
      const decoded = factory.interface.parseLog(auctionCreatedEvent);
      const auctionAddress = decoded.args.auctionAddress;

      expect(await factory.auctionByNFT(
        await nftMarketplace.getAddress(),
        1
      )).to.equal(auctionAddress);
    });

    it("应该记录卖家的所有拍卖", async function () {
      await nftMarketplace.mint(seller.address);
      await nftMarketplace.mint(seller.address);
      await nftMarketplace.connect(seller).setApprovalForAll(
        await factory.getAddress(),
        true
      );

      const startTime = await time.latest() + 100;
      const endTime = startTime + 3600;

      await factory.connect(seller).createAuction(
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      await factory.connect(seller).createAuction(
        await nftMarketplace.getAddress(),
        2,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      const auctions = await factory.getAuctionsBySeller(seller.address);
      expect(auctions.length).to.equal(2);
    });

    it("不应该允许为同一NFT创建多个拍卖", async function () {
      await nftMarketplace.mint(seller.address);
      await nftMarketplace.connect(seller).approve(
        await factory.getAddress(),
        1
      );

      const startTime = await time.latest() + 100;
      const endTime = startTime + 3600;

      await factory.connect(seller).createAuction(
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      await expect(
        factory.connect(seller).createAuction(
          await nftMarketplace.getAddress(),
          1,
          ethers.ZeroAddress,
          startTime,
          endTime,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Auction already exists");
    });
  });

  describe("查询功能", function () {
    beforeEach(async function () {
      await nftMarketplace.mint(seller.address);
      await nftMarketplace.connect(seller).approve(
        await factory.getAddress(),
        1
      );
    });

    it("应该返回所有拍卖", async function () {
      const startTime = await time.latest() + 100;
      const endTime = startTime + 3600;

      await factory.connect(seller).createAuction(
        await nftMarketplace.getAddress(),
        1,
        ethers.ZeroAddress,
        startTime,
        endTime,
        ethers.parseEther("0.1")
      );

      const allAuctions = await factory.getAllAuctions();
      expect(allAuctions.length).to.equal(1);
    });
  });

  describe("管理功能", function () {
    it("应该允许所有者更新拍卖实现", async function () {
      const Auction = await ethers.getContractFactory("Auction");
      const newImplementation = await Auction.deploy();
      await newImplementation.waitForDeployment();

      await factory.setAuctionImplementation(await newImplementation.getAddress());
      expect(await factory.auctionImplementation()).to.equal(await newImplementation.getAddress());
    });

    it("应该允许所有者更新价格预言机", async function () {
      const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      const newPriceFeed = await MockPriceFeed.deploy();
      await newPriceFeed.waitForDeployment();
      await newPriceFeed.setPrice(4000 * 10 ** 8);

      const PriceOracle = await ethers.getContractFactory("PriceOracle");
      const newPriceOracle = await upgrades.deployProxy(
        PriceOracle,
        [await newPriceFeed.getAddress()],
        { initializer: "initialize" }
      );
      await newPriceOracle.waitForDeployment();

      await factory.setPriceOracle(await newPriceOracle.getAddress());
      expect(await factory.priceOracle()).to.equal(await newPriceOracle.getAddress());
    });

    it("不应该允许非所有者更新实现", async function () {
      const Auction = await ethers.getContractFactory("Auction");
      const newImplementation = await Auction.deploy();
      await newImplementation.waitForDeployment();

      await expect(
        factory.connect(seller).setAuctionImplementation(await newImplementation.getAddress())
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });
});

const anyValue = () => true;
