const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("NFTMarketplace", function () {
  let nftMarketplace;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
    nftMarketplace = await NFTMarketplace.deploy(
      "Test NFT",
      "TNFT",
      "https://example.com/api/token/"
    );
    await nftMarketplace.waitForDeployment();
  });

  describe("Deployment", function () {
    it("应该正确设置名称和符号", async function () {
      expect(await nftMarketplace.name()).to.equal("Test NFT");
      expect(await nftMarketplace.symbol()).to.equal("TNFT");
    });

    it("应该正确设置所有者", async function () {
      expect(await nftMarketplace.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("应该允许铸造NFT", async function () {
      await expect(nftMarketplace.mint(user1.address))
        .to.emit(nftMarketplace, "NFTMinted")
        .withArgs(user1.address, 1);

      expect(await nftMarketplace.ownerOf(1)).to.equal(user1.address);
      expect(await nftMarketplace.balanceOf(user1.address)).to.equal(1);
    });

    it("应该允许批量铸造NFT", async function () {
      const tx = await nftMarketplace.mintBatch(user1.address, 5);
      await tx.wait();

      expect(await nftMarketplace.balanceOf(user1.address)).to.equal(5);
      expect(await nftMarketplace.ownerOf(1)).to.equal(user1.address);
      expect(await nftMarketplace.ownerOf(5)).to.equal(user1.address);
    });

    it("应该正确分配tokenId", async function () {
      await nftMarketplace.mint(user1.address);
      await nftMarketplace.mint(user2.address);
      await nftMarketplace.mint(user1.address);

      expect(await nftMarketplace.ownerOf(1)).to.equal(user1.address);
      expect(await nftMarketplace.ownerOf(2)).to.equal(user2.address);
      expect(await nftMarketplace.ownerOf(3)).to.equal(user1.address);
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      await nftMarketplace.mint(user1.address);
    });

    it("应该允许NFT转移", async function () {
      await nftMarketplace.connect(user1).transferFrom(
        user1.address,
        user2.address,
        1
      );

      expect(await nftMarketplace.ownerOf(1)).to.equal(user2.address);
    });

    it("应该允许safeTransferFrom", async function () {
      await nftMarketplace.connect(user1)["safeTransferFrom(address,address,uint256)"](
        user1.address,
        user2.address,
        1
      );

      expect(await nftMarketplace.ownerOf(1)).to.equal(user2.address);
    });
  });
});
