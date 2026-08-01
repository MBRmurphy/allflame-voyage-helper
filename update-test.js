const assert = require("node:assert/strict");
const fs = require("node:fs");
const { compareVersions, selectWindowsPortableAsset, selectChecksumAsset, checksumForAsset, releaseUpdateInfo } = require("./src/shared/update-core.js");

assert.equal(compareVersions("0.2.0", "0.1.9"), 1);
assert.equal(compareVersions("v1.0.0", "1.0"), 0);
assert.equal(compareVersions("0.1.0", "0.1.1"), -1);

const release = {
  tag_name: "v0.2.0",
  name: "Voyage Helper v0.2.0",
  html_url: "https://github.com/MBRmurphy/allflame-voyage-helper/releases/tag/v0.2.0",
  body: "Update notes",
  published_at: "2026-07-31T00:00:00Z",
  assets: [
    { name: "source.zip", browser_download_url: "https://github.com/example/source.zip" },
    { name: "PoE-Allflame-Voyage-Helper.exe", browser_download_url: "https://github.com/MBRmurphy/allflame-voyage-helper/releases/download/v0.2.0/PoE-Allflame-Voyage-Helper.exe" },
    { name: "SHA256SUMS.txt", browser_download_url: "https://github.com/MBRmurphy/allflame-voyage-helper/releases/download/v0.2.0/SHA256SUMS.txt" },
  ],
};
assert.equal(selectWindowsPortableAsset(release).name, "PoE-Allflame-Voyage-Helper.exe");
assert.equal(selectChecksumAsset(release).name, "SHA256SUMS.txt");
assert.equal(checksumForAsset(`${"a".repeat(64)} *PoE-Allflame-Voyage-Helper.exe\n${"b".repeat(64)} *web.zip`, "PoE-Allflame-Voyage-Helper.exe"), "a".repeat(64));
assert.equal(checksumForAsset(`${"a".repeat(64)} *other.exe`, "PoE-Allflame-Voyage-Helper.exe"), null);
assert.equal(checksumForAsset(`${"a".repeat(64)} *../PoE-Allflame-Voyage-Helper.exe`, "PoE-Allflame-Voyage-Helper.exe"), null);
const update = releaseUpdateInfo(release, "0.1.0");
assert.equal(update.available, true);
assert.equal(update.latestVersion, "0.2.0");
assert.equal(update.assetName, "PoE-Allflame-Voyage-Helper.exe");
assert.match(update.downloadUrl, /^https:\/\/github\.com\//);
assert.match(update.checksumUrl, /SHA256SUMS\.txt$/);

const current = releaseUpdateInfo({ ...release, tag_name: "v0.1.0" }, "0.1.0");
assert.equal(current.available, false);
const untrusted = releaseUpdateInfo({ ...release, html_url: "https://example.com/release", assets: [{ name: "app.exe", browser_download_url: "https://example.com/app.exe" }] }, "0.1.0");
assert.equal(untrusted.downloadUrl, null);
const untrustedChecksum = releaseUpdateInfo({ ...release, assets: release.assets.map((asset) => asset.name === "SHA256SUMS.txt" ? { ...asset, browser_download_url: "https://example.com/SHA256SUMS.txt" } : asset) }, "0.1.0");
assert.equal(untrustedChecksum.checksumUrl, null);

const installerScript = fs.readFileSync("./src/install-update.ps1", "utf8");
assert.match(installerScript, /Get-FileHash/);
assert.match(installerScript, /\.update-old/);
assert.match(installerScript, /Start-Process -FilePath \$Target/);
assert.match(installerScript, /Restored and restarted the previous executable/);

console.log("Update checker tests passed");
