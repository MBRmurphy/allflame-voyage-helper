function versionParts(version) {
  return String(version || "0")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length, 3);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function selectWindowsPortableAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  return assets.find((asset) => /PoE-Allflame-Voyage-Helper.*\.exe$/i.test(asset?.name || ""))
    || assets.find((asset) => /\.exe$/i.test(asset?.name || ""))
    || null;
}

function selectChecksumAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  return assets.find((asset) => /^SHA256SUMS\.txt$/i.test(asset?.name || "")) || null;
}

function checksumForAsset(checksumText, assetName) {
  const wantedName = String(assetName || "").trim().toLowerCase();
  if (!wantedName) return null;
  for (const line of String(checksumText || "").split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (match && match[2].trim().toLowerCase() === wantedName) return match[1].toLowerCase();
  }
  return null;
}

function releaseUpdateInfo(release, currentVersion) {
  const latestVersion = String(release?.tag_name || release?.name || "").replace(/^v/i, "");
  if (!latestVersion) throw new Error("The latest GitHub release has no version tag.");
  const asset = selectWindowsPortableAsset(release);
  const checksumAsset = selectChecksumAsset(release);
  const releaseUrl = /^https:\/\/github\.com\//i.test(release?.html_url || "") ? release.html_url : null;
  const assetUrl = /^https:\/\/github\.com\//i.test(asset?.browser_download_url || "") ? asset.browser_download_url : null;
  const checksumUrl = /^https:\/\/github\.com\//i.test(checksumAsset?.browser_download_url || "") ? checksumAsset.browser_download_url : null;
  return {
    checked: true,
    currentVersion,
    latestVersion,
    available: compareVersions(latestVersion, currentVersion) > 0,
    releaseName: release?.name || release?.tag_name || `v${latestVersion}`,
    notes: String(release?.body || "").slice(0, 4000),
    publishedAt: release?.published_at || null,
    downloadUrl: assetUrl || releaseUrl,
    releaseUrl,
    assetName: asset?.name || null,
    checksumUrl,
    checksumAssetName: checksumAsset?.name || null,
  };
}

module.exports = { compareVersions, selectWindowsPortableAsset, selectChecksumAsset, checksumForAsset, releaseUpdateInfo };
