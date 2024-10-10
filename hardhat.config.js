require("dotenv").config();
require("@reef-chain/hardhat-reef");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
//

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  defaultNetwork: "reef",
  networks: {
    reef: {
      url: "ws://substrate-node:9944",
      scanUrl: "http://api:8000",
    },
    reef_testnet: {
      url: "wss://rpc-testnet.reefscan.com/ws",
      scanUrl: "https://testnet.reefscan.com", // Localhost verification testing: http://localhost:3000
      seeds: {
        account1: process.env.MNEMONIC_TESTNET || "",
      },
      contracts: {
        market: "0x0a3F2785dBBC5F022De511AAB8846388B78009fD",
        nft: "0x1A511793FE92A62AF8bC41d65d8b94d4c2BD22c3",
      }
    },
    reef_mainnet: {
      url: "wss://rpc.reefscan.com/ws",
      scanUrl: "wss://reefscan.com",
      seeds: {
        account1: process.env.MNEMONIC_MAINNET || "",
      },
      contracts: {
        market: "0xB13Be9656B243600C86922708C20606f5EA89218",
        nft: "0x0601202b75C96A61CDb9A99D4e2285E43c6e60e4",
      }
    },
  },
};
