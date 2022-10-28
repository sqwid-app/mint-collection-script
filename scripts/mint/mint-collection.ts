const hre = require("hardhat");
const fs = require('fs');
import {create as createIPFS, globSource,} from 'ipfs-http-client';

export const MINT_SCRIPT_DIR = './scripts/mint/';
export const COLLECTION_ASSETS_DIR = MINT_SCRIPT_DIR + 'collection-assets/';
export const COLLECTION_IMAGE_ASSETS_DIR = COLLECTION_ASSETS_DIR + 'images/';
export const COLLECTION_JSON_ASSETS_DIR = COLLECTION_ASSETS_DIR + 'json/';
export const MINT_ASSETS_DIR_NAME = 'mint-assets';
export const MINT_ASSETS_OLD_DIR = MINT_SCRIPT_DIR+MINT_ASSETS_DIR_NAME+'-old';
export const MINT_ASSETS_DIR = MINT_SCRIPT_DIR + `${MINT_ASSETS_DIR_NAME}/`;
const MINT_ASSETS_IMAGES_DIR = MINT_ASSETS_DIR + 'images/';
const MINT_ASSETS_JSON_DIR = MINT_ASSETS_DIR + 'json/';
export const MINTED_FILE_PATH = MINT_ASSETS_DIR + 'mintedIds.json';

const projectId = process.env.INFURA_IPFS_PROJECT_ID;
const projectSecret = process.env.INFURA_IPFS_SECRET;
const auth =
    'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');


function saveUploadMetadata(jsonDirPath: string, fileNr: string, ipfsFileData: { path: any; cid: any }, jsonUploadDirPath: string): Promise<void> {
    return new Promise(((resolve, reject) => {
        let jsonPath = `${jsonDirPath}/${fileNr}.json`;
        fs.readFile(jsonPath, (err: any, text: any) => {
            if (err) {
                console.log("ERROR JSON READ=", jsonPath);
                return;
            }
            const metadata = JSON.parse(text.toString());
            metadata.image = 'ipfs://' + ipfsFileData.cid;
            metadata.media = 'ipfs://' + ipfsFileData.cid;
            metadata.thumbnail = 'ipfs://' + ipfsFileData.cid;
            // metadata.name = "Collection Item #" + fileNr;
            // metadata.description = '';
            fs.writeFile(jsonUploadDirPath + fileNr + '.json', JSON.stringify(metadata), (err: any) => {
                if (err) {
                    console.log("ERROR WRITE UPLOAD JSON=", err, metadata);
                    reject(err);
                    return;
                }
                resolve();
            });
        })
    }));
}

async function uploadImages(ipfsClient: any, ipfsImagesDir: string, jsonUploadDirPath: string, onImageUploadFn: (fileNr: string, ipfsFileData: { path: string, cid: string }) => void) {
    for await (const file of ipfsClient.addAll(globSource(MINT_ASSETS_IMAGES_DIR, '**/*'))) {
        fs.writeFile(MINT_ASSETS_DIR + ipfsImagesDir + 'ipfs-image-' + file.path.substring(0, file.path.indexOf('.')) + '.json', JSON.stringify({
            path: file.path,
            cid: file.cid.toString()
        }), function (err: any) {
            if (err) throw err;
            let ipfsFileData = {path: file.path, cid: file.cid.toString()};
            const fileNr = ipfsFileData.path.substring(0, ipfsFileData.path.indexOf('.'));
            onImageUploadFn(fileNr, ipfsFileData)
        });
    }
}

async function uploadJSONMetadata(ipfsClient: any, jsonUploadDirPath: string, ipfsJsonDir: string) {
    for await (const file of ipfsClient.addAll(globSource(jsonUploadDirPath, '**/*'))) {
        fs.writeFile(MINT_ASSETS_DIR + ipfsJsonDir + 'ipfs-json-' + file.path.substring(0, file.path.indexOf('.')) + '.json', JSON.stringify({
            path: file.path,
            cid: file.cid.toString()
        }), function (err: any) {
            if (err) throw err;
            // console.log('SAVED', {path:file.path, cid:file.cid.toString()});

        });
    }
}

function addToMintedNftIds(nftIds: string[], uris: string[]) {
    let currentVal: (string|{nftId:string, uri:string})[] = [];
    try {
        currentVal = JSON.parse(fs.readFileSync(MINTED_FILE_PATH).toString());
    } catch (err) {}
    const newVal = currentVal;
    nftIds.forEach((nId: string, index:number) => {
        if (!(newVal.find((nv:any)=>nv===nId||nv.nftId===nId))) {
            newVal.push({nftId:nId, uri:uris[index]});
        }
    });
    fs.writeFileSync(MINTED_FILE_PATH, JSON.stringify(newVal));
}

async function uploadAllToIPFS(ipfsUploadedMetadataDirPath: string, ipfsJsonDir: string) {
    const ipfsClient = await createIPFS({
        host: 'ipfs.infura.io',
        port: 5001,
        protocol: 'https',
        headers: {
            authorization: auth,
        },
    });

    fs.mkdir(ipfsUploadedMetadataDirPath, {recursive: true}, (err: any) => {
        if (err) throw err;
    });
    let ipfsImagesDir = 'ipfs-images/';
    fs.mkdir(MINT_ASSETS_DIR + ipfsImagesDir, {recursive: true}, (err: any) => {
        if (err) throw err;
    });

    let ipfsUploadJsonDir = 'upload-json/';
    let jsonUploadDirPath = MINT_ASSETS_DIR + ipfsUploadJsonDir;
    fs.mkdir(jsonUploadDirPath, {recursive: true}, (err: any) => {
        if (err) throw err;
    });

    console.log('uploading images to ipfs');
    await uploadImages(ipfsClient, ipfsImagesDir, jsonUploadDirPath,
        async (fileNr, ipfsFileData) => await saveUploadMetadata(MINT_ASSETS_JSON_DIR, fileNr, ipfsFileData, jsonUploadDirPath));

    console.log('uploading metadata to ipfs');
    await uploadJSONMetadata(ipfsClient, jsonUploadDirPath, ipfsJsonDir);
    console.log('all uploaded to ipfs');
}

function prepareUploadAssets(from: number, to: number) {
    try {
        // fs.rmdirSync(MINT_ASSETS_DIR, {recursive: true});
        const files = fs.readdirSync(MINT_SCRIPT_DIR);
        if (files.indexOf(MINT_ASSETS_DIR_NAME)>-1) {
            if(files.indexOf(MINT_ASSETS_OLD_DIR)<-1) {
                fs.mkdirSync(MINT_ASSETS_OLD_DIR);
            }
            const oldMints = fs.readdirSync(MINT_ASSETS_OLD_DIR);
            const lastMintNr = oldMints.reduce((max:number, curr: string)=>parseInt(curr)>max?parseInt(curr):max,0);
            fs.renameSync(MINT_ASSETS_DIR, MINT_ASSETS_OLD_DIR+'/'+(lastMintNr+1) )
            console.log('moved to old mint dir');
        }
    } catch (e: any) {
    }

    fs.mkdirSync(MINT_ASSETS_DIR, {recursive: true});
    fs.mkdirSync(MINT_ASSETS_IMAGES_DIR, {recursive: true});
    fs.mkdirSync(MINT_ASSETS_JSON_DIR, {recursive: true});
    const images = fs.readdirSync(COLLECTION_IMAGE_ASSETS_DIR);
    const copyImages = images.filter((img: string) => {
        const fileNr = img.substring(0, img.indexOf('.'));
        let fNr = Number.parseInt(fileNr);
        return fNr >= from && fNr <= to;
    });
    copyImages.forEach((img: string) => fs.copyFileSync(COLLECTION_IMAGE_ASSETS_DIR + img, MINT_ASSETS_IMAGES_DIR + img))

    const json = fs.readdirSync(COLLECTION_JSON_ASSETS_DIR);
    const copyJson = json.filter((jsn: string) => {
        const fileNr = jsn.substring(0, jsn.indexOf('.'));
        let fNr = Number.parseInt(fileNr);
        return fNr >= from && fNr <= to;
    });
    copyJson.forEach((jsn: string) => fs.copyFileSync(COLLECTION_JSON_ASSETS_DIR + jsn, MINT_ASSETS_JSON_DIR + jsn))
    console.log('created new directories');
}

async function mintNFTs(ipfsUploadedMetadataDirPath: string, alreadyMinted: string[]) {
    let contracts = hre.config.networks[hre.network.name].contracts;

    let nftContractAddress = contracts.nft;
    let marketContractAddress = contracts.market;
    const creatorAccount = await hre.reef.getSignerByName("account1");
    let creatorAddress = await creatorAccount.getAddress();
    const Market = await hre.reef.getContractAt("SqwidMarketplace", marketContractAddress, creatorAccount);
    const NFT1155 = await hre.reef.getContractAt("SqwidERC1155", nftContractAddress, creatorAccount);

    const uploadedIPFSMetadataArr = fs.readdirSync(ipfsUploadedMetadataDirPath).map((file: string) => {
        const uploadedMetadata = JSON.parse(fs.readFileSync(ipfsUploadedMetadataDirPath + file).toString());
        return 'ipfs://' + uploadedMetadata.cid;
    });
    if (alreadyMinted && alreadyMinted.length) {

        const removed = uploadedIPFSMetadataArr.splice(0, alreadyMinted.length);
        console.log("removed from minting=",removed.length, ' and resuming AFTER ',removed[removed.length-1]);
        console.log("continue mint of items nr=",uploadedIPFSMetadataArr.length);
    }
    let nftIpfsUriArr = uploadedIPFSMetadataArr;
    let nftQuantityArr = uploadedIPFSMetadataArr.map(() => 1);
    let nftMimeTypeArr = uploadedIPFSMetadataArr.map(() => 'image');
    let nftRoyaltiesAddrArr = uploadedIPFSMetadataArr.map(() => creatorAddress);
    let nftRoyaltyArr = uploadedIPFSMetadataArr.map(() => 400);

    for (var i in nftIpfsUriArr) {
        const tx = await Market
            .mint(
                nftQuantityArr[i],
                nftIpfsUriArr[i],
                nftMimeTypeArr[i],
                nftRoyaltiesAddrArr[i],
                nftRoyaltyArr[i]
            );
        const receipt = await tx.wait();
        let nftIds = receipt.events.filter((e: any) => e.event === 'ItemCreated').map((itm: any) => itm.args.tokenId.toString());
        let mintedUri = nftIpfsUriArr[i];
        console.log("minted ids=", nftIds, mintedUri);

        addToMintedNftIds(nftIds, [mintedUri]);
    }
    /*const tx = await Market
        .mintBatch(
            nftQuantityArr,
            nftIpfsUriArr,
            nftMimeTypeArr,
            nftRoyaltiesAddrArr,
            nftRoyaltyArr
        );
    const receipt = await tx.wait();
    let nftIds = receipt.events.filter((e:any)=>e.event==='ItemCreated').map((itm:any)=>itm.args.tokenId.toString());
    console.log("minted ids=",nftIds);

    addToMintedNftIds(nftIds);*/
}

async function mintCollection() {
    let ipfsJsonDir = 'ipfs-json/';
    let ipfsUploadedMetadataDirPath = MINT_ASSETS_DIR + ipfsJsonDir;
    let minted
    try {
        minted = JSON.parse(fs.readFileSync(MINTED_FILE_PATH).toString());
    } catch (e: any) {}
    if (!minted) {
        prepareUploadAssets(1,2);
        await uploadAllToIPFS(ipfsUploadedMetadataDirPath, ipfsJsonDir);
    }
    await mintNFTs(ipfsUploadedMetadataDirPath, minted);

}

mintCollection()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
