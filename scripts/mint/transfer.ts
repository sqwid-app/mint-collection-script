const hre = require("hardhat");
const fs = require('fs');

export const MINT_SCRIPT_DIR = './scripts/mint/';
const DROP_ADDR_FILE_PATH = MINT_SCRIPT_DIR + 'transferToAddresses.json';
export const MINT_ASSETS_DIR = MINT_SCRIPT_DIR + 'mint-assets/';
export const MINTED_FILE_PATH = MINT_ASSETS_DIR + 'mintedIds.json';
export const TRANSFERS_SUCCESS_FILE_PATH = MINT_SCRIPT_DIR + 'transferred-success.json';
export const TRANSFER_ERRORS_FILE_PATH = MINT_SCRIPT_DIR + 'transferred-error.json';

function getNftIds() {
    return JSON.parse(fs.readFileSync(MINTED_FILE_PATH).toString()).map((mintedNft:string|{nftId:string, uri:string})=>{
        if (typeof mintedNft === 'string' || mintedNft instanceof String) {
            return mintedNft;
        }
        return (mintedNft as {nftId:string, uri:string}).nftId;
    });
}

function mergeNftWithAddr(nftIds: string[], dropAddresses: string[]): { address: string, nftId: string }[] {
    return dropAddresses.map((address: string, i: number) => ({address, nftId: nftIds[i]}));
}

type Transfer = {
    from: string;
    to: string;
    nftId: string;
    amount: string;
};

function addToTransfers(transfers: Transfer[]) {
    let currentVal: Transfer[] = [];
    try {
        currentVal = JSON.parse(fs.readFileSync(TRANSFERS_SUCCESS_FILE_PATH).toString());
    } catch (err) {
    }
    const newVal = currentVal.concat(transfers);
    fs.writeFileSync(TRANSFERS_SUCCESS_FILE_PATH, JSON.stringify(newVal));
}

function addToTransferErrors(nftIdError: { address: string, nftId: string, err: string }) {
    let currentVal: { address: string, nftId: string, err: string }[] = [];
    try {
        currentVal = JSON.parse(fs.readFileSync(TRANSFER_ERRORS_FILE_PATH).toString());
    } catch (err) {}
    const newVal = currentVal.concat([nftIdError]);
    fs.writeFileSync(TRANSFER_ERRORS_FILE_PATH, JSON.stringify(newVal));
}

function getAlreadyDroppedLen() {
    const {succ, err} = getAlreadyDroppedSuccErr();
    return succ.length + err.length;
}

function getAlreadyDroppedSuccErr():{succ: any[], err:any[]} {
    let succ = [];
    let err = [];
    try {
        succ = JSON.parse(fs.readFileSync(TRANSFERS_SUCCESS_FILE_PATH).toString());
    } catch (e: any) {
    }
    try {
        err = JSON.parse(fs.readFileSync(TRANSFER_ERRORS_FILE_PATH).toString());
    } catch (e: any) {
    }
    return {succ, err};
}

async function transfer() {
    const contracts = hre.config.networks[hre.network.name].contracts;
    let nftContractAddress = contracts.nft;
    let marketContractAddress = contracts.market;
    const creatorAccount = await hre.reef.getSignerByName("account1");
    let creatorAddress = await creatorAccount.getAddress();
    const Market = await hre.reef.getContractAt("SqwidMarketplace", marketContractAddress, creatorAccount);
    const NFT1155 = await hre.reef.getContractAt("SqwidERC1155", nftContractAddress, creatorAccount);

    const nftIds = getNftIds();
    const dropAddresses = JSON.parse(fs.readFileSync(DROP_ADDR_FILE_PATH).toString());

    if (nftIds.length < dropAddresses.length) {
        throw new Error('Not enough minted nft ids');
    }

    const nftIdAddrArr = mergeNftWithAddr(nftIds, dropAddresses);
    const droppedLength = getAlreadyDroppedLen();
    if (droppedLength) {
        nftIdAddrArr.splice(0, droppedLength);
    }

    for (let nftIdAddr of nftIdAddrArr) {
        const provider = await hre.reef.getProvider();
        const substrateAddr = await provider.api.query.evmAccounts.accounts(nftIdAddr.address);
        if (!substrateAddr.toString()) {
            console.log('ERROR transfer not Reef EVM address=' + nftIdAddr.address);
            addToTransferErrors({...nftIdAddr, err: 'Not Reef EVM address'})
            continue;
        }
        const creatorBalance = await NFT1155.balanceOf(creatorAddress, nftIdAddr.nftId);
        const amount = 1;
        if (!creatorBalance.gte(amount)) {
            console.log('ERROR transfer gte balance=' + nftIdAddr.nftId, ' bal=', creatorBalance.toString());
            addToTransferErrors({...nftIdAddr, err: 'No balance in from acc'})
            continue;
        }
        try {
            const tx = await NFT1155.safeTransferFrom(
                creatorAddress,
                nftIdAddr.address,
                nftIdAddr.nftId,
                amount,
                []
            );
            const receipt = await tx.wait();
            let transfers = receipt.events.filter((ev: any) => ev.event === 'TransferSingle').map((ev: any) => (
                {
                    from: ev.args.from,
                    to: ev.args.to,
                    nftId: ev.args.id.toString(),
                    amount: ev.args.value.toString()
                }
            ));
            console.log("SUCCESS transfer=", nftIdAddr);
            addToTransfers(transfers);
        } catch (err: any) {
            console.log("ERROR transfer=", nftIdAddr, err);
            addToTransferErrors({...nftIdAddr, err})
        }
    }
    const {succ, err} = getAlreadyDroppedSuccErr();
    console.log("TRANSFERS COMPLETE err=", err.length, ' success=', succ.length);

}

transfer()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
