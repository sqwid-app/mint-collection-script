# Mint NFT collection

Script to mint collection from image and json directories.


## Installing

Install dependencies with `yarn`.

Set collection images in `scripts/mint/collection-assets/images` and json files in `scripts/mint/collection-assets/json`. All file names must be incremental and same json number is used for image when publishing and minting.

## Running

Copy `.env.example` to `.env` (`cp .env.example .env`) and update the desired mnemonic variable to your account seed mnemonic for the corresponding network.
Set Infura IPFS project values. 

## Scripts

See `scripts/mint` folder for `mint-collection.ts` and `transfer.ts`.

Set the sequence of minted images in `prepareUploadAssets([fromNr],[toNr])` in `mint-collection.ts` file.
If you need to change the metadata json before uploading to IPFS see `saveUploadMetadata` function.
Script will upload images to IPFS and set IPFS address to metadata JSON that will be minted to Sqwid NFT contract.
For this run:
```
yarn hardhat run scripts/mint/mint-collection.ts --network reef_testnet 
```
Script will also save temporary values in files in case you lose connection and resume from last minted NFT.


To drop NFTs to various addresses you set them in `transferToAddresses.json` and run:

```
yarn hardhat run scripts/mint/transfer.ts --network reef_testnet
```

To get initial REEF tokens on the testnet, visit [dev Matrix chat](https://app.element.io/#/room/#reef:matrix.org) and use the following command:
```
!drip REEF_ADDRESS
```
