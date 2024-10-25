import { ObjectManager } from "@filebase/sdk";
import fs from "fs";
import path from "path";
import { promisify } from "util";

export const MINT_SCRIPT_DIR = "./scripts/mint/";
export const COLLECTION_ASSETS_DIR = MINT_SCRIPT_DIR + "collection-assets/";
export const COLLECTION_IMAGE_ASSETS_DIR = COLLECTION_ASSETS_DIR + "images/";
export const COLLECTION_JSON_ASSETS_DIR = COLLECTION_ASSETS_DIR + "json/";
export const MINT_ASSETS_DIR_NAME = "mint-assets";
export const MINT_ASSETS_OLD_DIR =
  MINT_SCRIPT_DIR + MINT_ASSETS_DIR_NAME + "-old";
export const MINT_ASSETS_DIR = MINT_SCRIPT_DIR + `${MINT_ASSETS_DIR_NAME}/`;
const MINT_ASSETS_IMAGES_DIR = MINT_ASSETS_DIR + "images/";
const MINT_ASSETS_JSON_DIR = MINT_ASSETS_DIR + "json/";
export const MINTED_FILE_PATH = MINT_ASSETS_DIR + "mintedIds.json";

const objectManager = new ObjectManager(process.env.S3_KEY, process.env.S3_SECRET, {
  bucket: process.env.BUCKET_NAME
});

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const copyFile = promisify(fs.copyFile);
const rename = promisify(fs.rename);

async function saveUploadMetadata(
  jsonDirPath: string,
  fileNr: string,
  ipfsFileData: { path: any; cid: any },
  jsonUploadDirPath: string
): Promise<void> {
  const jsonPath = `${jsonDirPath}/${fileNr}.json`;
  try {
    const text = await fs.promises.readFile(jsonPath, "utf8");
    const metadata = JSON.parse(text);
    metadata.image = "ipfs://" + ipfsFileData.cid;
    metadata.media = "ipfs://" + ipfsFileData.cid;
    metadata.thumbnail = "ipfs://" + ipfsFileData.cid;
    metadata.image = "ipfs://" + ipfsFileData.cid;
    metadata.media = "ipfs://" + ipfsFileData.cid;
    metadata.thumbnail = "ipfs://" + ipfsFileData.cid;

    await writeFile(jsonUploadDirPath + fileNr + ".json", JSON.stringify(metadata));
  } catch (err) {
    console.error("Error in saveUploadMetadata:", err);
    throw err;
  }
}


async function prepareUploadAssets(from: number, to: number) {
  try {
    const files = await readdir(MINT_SCRIPT_DIR);
    if (files.indexOf(MINT_ASSETS_DIR_NAME) > -1) {
      const oldDirName = path.basename(MINT_ASSETS_OLD_DIR);
      if (files.indexOf(oldDirName) == -1) {
        await mkdir(MINT_ASSETS_OLD_DIR);
      }
      const oldMints = await readdir(MINT_ASSETS_OLD_DIR);
      const lastMintNr = oldMints.reduce(
        (max: number, curr: string) =>
          parseInt(curr) > max ? parseInt(curr) : max,
        0
      );
      await rename(
        MINT_ASSETS_DIR,
        MINT_ASSETS_OLD_DIR + "/" + (lastMintNr + 1)
      );
      console.log("Moved to old mint dir");
    }
  } catch (e) {
    throw e;
  }

  await mkdir(MINT_ASSETS_DIR, { recursive: true });
  await mkdir(MINT_ASSETS_IMAGES_DIR, { recursive: true });
  await mkdir(MINT_ASSETS_JSON_DIR, { recursive: true });

  const images = await readdir(COLLECTION_IMAGE_ASSETS_DIR);
  const copyImages = images.filter((img: string) => {
    const fileNr = img.substring(0, img.indexOf("."));
    let fNr = Number.parseInt(fileNr);
    return fNr >= from && fNr <= to;
  });
  for (const img of copyImages) {
    await copyFile(
      COLLECTION_IMAGE_ASSETS_DIR + img,
      MINT_ASSETS_IMAGES_DIR + img
    );
  }

  const jsonFiles = await readdir(COLLECTION_JSON_ASSETS_DIR);
  const copyJson = jsonFiles.filter((jsn: string) => {
    const fileNr = jsn.substring(0, jsn.indexOf("."));
    let fNr = Number.parseInt(fileNr);
    return fNr >= from && fNr <= to;
  });
  for (const jsn of copyJson) {
    await copyFile(
      COLLECTION_JSON_ASSETS_DIR + jsn,
      MINT_ASSETS_JSON_DIR + jsn
    );
  }
  console.log("Created new directories");
  return true;
}

// Function to recursively get all files in a directory and its subdirectories
const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []): string[] => {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);

    if (fs.statSync(filePath).isDirectory()) {
      // If it's a directory, recurse into it
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      // If it's a file, add it to the array
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
};

// Main function to upload all files
const uploadImages = async (directoryPath: string, ipfsImagesDir: string, jsonUploadDirPath: string, onImageUpload: (
  fileNr: string,
  ipfsFileData: { path: string; cid: string }
) => void): Promise<boolean> => {
  const files = getAllFiles(directoryPath);

  for (const filePath of files) {
    const fileContent = fs.readFileSync(filePath);
    const objectName = path.relative(directoryPath, filePath);
    const ObjectNameWithoutExtension = objectName.substring(0, objectName.indexOf("."));

    try {
      const uploadedObject = await objectManager.upload(
        objectName,            // Object name in Filebase bucket
        fileContent,           // File content (buffer)
        "",                   // Metadata (can be customized)
        {}                     // Additional options (if needed)
      );

      const uploadedObjectDetails = {
        path: filePath,
        cid: uploadedObject.cid.toString(),
      }

      await writeFile(
        MINT_ASSETS_DIR +
        ipfsImagesDir +
        "ipfs-image-" +
        ObjectNameWithoutExtension +
        ".json",
        JSON.stringify(uploadedObjectDetails),
        // function (err: any) {
        //   if (err) throw err;
        //   onImageUpload(ObjectNameWithoutExtension, uploadedObjectDetails);
        // }
      );

      await onImageUpload(ObjectNameWithoutExtension, uploadedObjectDetails);

      console.log(`Uploaded ${objectName}:`, uploadedObject);
    } catch (error) {
      console.error(`Failed to upload ${objectName}:`, error);
    }
  }

  return true;
};

async function uploadJSONMetadata(
  directoryPath: string,
  ipfsJsonDir: string
) {

  const files = getAllFiles(directoryPath);

  for (const filePath of files) {
    const fileContent = fs.readFileSync(filePath);
    const objectName = path.relative(directoryPath, filePath);
    const ObjectNameWithoutExtension = objectName.substring(0, objectName.indexOf("."));

    try {
      const uploadedObject = await objectManager.upload(
        objectName,            // Object name in Filebase bucket
        fileContent,           // File content (buffer)
        "",                   // Metadata (can be customized)
        {}                     // Additional options (if needed)
      );

      const uploadedObjectDetails = {
        path: filePath,
        cid: uploadedObject.cid.toString(),
      }

      await writeFile(
        MINT_ASSETS_DIR +
        ipfsJsonDir +
        "ipfs-json-" +
        ObjectNameWithoutExtension +
        ".json",
        JSON.stringify(uploadedObjectDetails),
        // function (err: any) {
        //   if (err) throw err;
        // }
      );
      console.log(`Uploaded ${objectName}:`, uploadedObject);
    } catch (error) {
      console.error(`Failed to upload ${objectName}:`, error);
    }
  }
}


async function uploadAllToIPFS(
  ipfsUploadedMetadataDirPath: string,
  ipfsJsonDir: string
) {
  fs.mkdir(ipfsUploadedMetadataDirPath, { recursive: true }, (err: any) => {
    if (err) throw err;
  });
  let ipfsImagesDir = "ipfs-images/";
  fs.mkdir(MINT_ASSETS_DIR + ipfsImagesDir, { recursive: true }, (err: any) => {
    if (err) throw err;
  });

  let ipfsUploadJsonDir = "upload-json/";
  let jsonUploadDirPath = MINT_ASSETS_DIR + ipfsUploadJsonDir;
  fs.mkdir(jsonUploadDirPath, { recursive: true }, (err: any) => {
    if (err) throw err;
  });

  console.log("Uploading images to IPFS...");
  const isImagesUploaded = await uploadImages(
    MINT_ASSETS_IMAGES_DIR,
    ipfsImagesDir,
    jsonUploadDirPath,
    async (fileNr, ipfsFileData) =>
      await saveUploadMetadata(MINT_ASSETS_JSON_DIR, fileNr, ipfsFileData, jsonUploadDirPath)
  );

  if (isImagesUploaded) {
    console.log("Uploading metadata to IPFS...");
    await uploadJSONMetadata(jsonUploadDirPath, ipfsJsonDir);
    console.log("All uploaded to IPFS");
  }
}
// Run the upload for a specified directory
(async () => {
  // const directoryToUpload = "./scripts/mint/mint-assets/images/"; // Replace with the directory path
  // await uploadImages(directoryToUpload);
  let ipfsJsonDir = "ipfs-json/";
  let ipfsUploadedMetadataDirPath = MINT_ASSETS_DIR + ipfsJsonDir;
  let minted;
  try {
    minted = JSON.parse(fs.readFileSync(MINTED_FILE_PATH).toString());
  } catch (e) { }
  if (!minted) {
    const isPrepared = await prepareUploadAssets(9, 10);
    if (isPrepared){
      await uploadAllToIPFS(ipfsUploadedMetadataDirPath, ipfsJsonDir);
    }
  }
})();