/**
 * Copyright (c) 2019-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

// Load required dependencies
const git = require('simple-git');
const path = require('path');
const fs = require("fs");
const fse = require("fs-extra");

// Remote deployment repo URL and local build/deploy paths
const remoteUrl = "https://github.com/molstar/molstar.github.io.git";
const buildDir = path.resolve(__dirname, '../build/');
const deployDir = path.resolve(buildDir, 'deploy/');
const localPath = path.resolve(deployDir, 'molstar.github.io/');

// HTML placeholder tag and the analytics snippet to inject into generated pages
//
// About the Cloudflare Web Analytics snippet below:
// - Purpose: Adds lightweight, privacy-focused page analytics to the generated static
//   pages (viewer and demos). It helps track page views, referrers, popular pages,
//   and basic performance metrics (e.g., TTFB, FCP) so we can understand usage and
//   improve the experience.
// - How it works: During deployment, we replace a placeholder comment in the built
//   HTML (<!-- __MOLSTAR_ANALYTICS__ -->) with Cloudflare’s beacon <script>. The
//   script sends anonymous usage and performance signals to Cloudflare’s analytics
//   endpoint. No cookies are used and no personal data is stored by the beacon.
// - Token: The data-cf-beacon "token" identifies our site in Cloudflare’s
//   analytics backend. It is not a secret; it’s safe to commit and publish.
// - Performance: The script is loaded with the "defer" attribute so it won’t block
//   the page from rendering. If the network blocks the script (e.g., offline or CSP),
//   the page still works and analytics are simply unavailable.
// - Security/CSP: If a Content Security Policy is enforced, make sure to allow
//   'https://static.cloudflareinsights.com' in the script-src directive; otherwise,
//   the beacon might be blocked.
// - Opt-out/Removal: To disable analytics for a page/template, remove the
//   placeholder from the HTML or change the replacement logic below.
const analyticsTag = /<!-- __MOLSTAR_ANALYTICS__ -->/g;
const analyticsCode = `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "c414cbae2d284ea995171a81e4a3e721"}'></script><!-- End Cloudflare Web Analytics -->`;

// simple-git output handler: pipe Git command output to the current process
function log(command, stdout, stderr) {
    if (command) {
        console.log('\n###', command);
        stdout.pipe(process.stdout);
        stderr.pipe(process.stderr);
    }
}

// Replace the analytics placeholder in the given HTML file with the actual analytics code
function addAnalytics(path) {
    const data = fs.readFileSync(path, 'utf8');
    const result = data.replace(analyticsTag, analyticsCode);
    fs.writeFileSync(path, result, 'utf8');
}

// Copy the built viewer artifacts into the local deployment repo and inject analytics into index.html
function copyViewer() {
    console.log('\n###', 'copy viewer files');
    const viewerBuildPath = path.resolve(buildDir, '../build/viewer/');
    const viewerDeployPath = path.resolve(localPath, 'viewer/');
    fse.copySync(viewerBuildPath, viewerDeployPath, { overwrite: true });
    addAnalytics(path.resolve(viewerDeployPath, 'index.html'));
}

// Copy example demos (lighting and alpha-orbitals) into the deployment repo and inject analytics
function copyDemos() {
    console.log('\n###', 'copy demos files');
    const lightingBuildPath = path.resolve(buildDir, '../build/examples/lighting/');
    const lightingDeployPath = path.resolve(localPath, 'demos/lighting/');
    fse.copySync(lightingBuildPath, lightingDeployPath, { overwrite: true });
    addAnalytics(path.resolve(lightingDeployPath, 'index.html'));

    const orbitalsBuildPath = path.resolve(buildDir, '../build/examples/alpha-orbitals/');
    const orbitalsDeployPath = path.resolve(localPath, 'demos/alpha-orbitals/');
    fse.copySync(orbitalsBuildPath, orbitalsDeployPath, { overwrite: true });
    addAnalytics(path.resolve(orbitalsDeployPath, 'index.html'));
}

// Orchestrate copying of all required files into the deployment repo
function copyFiles() {
    copyViewer();
    copyDemos();
}

// Ensure the local deployment path exists (creates nested directories if needed)
if (!fs.existsSync(localPath)) {
    console.log('\n###', 'create localPath');
    fs.mkdirSync(localPath, { recursive: true });
}

// Switch current working directory to the local deployment repository path
process.chdir(localPath);

// If the local repo is not initialized yet, clone it; otherwise, update it, then copy and push changes
if (!fs.existsSync(path.resolve(localPath, '.git/'))) {
    console.log('\n###', 'clone repository');
    git()
        // Show Git command outputs in the console
        .outputHandler(log)
        // Clone the remote GitHub Pages repository into the local path
        .clone(remoteUrl, localPath)
        // Fetch all refs from the remote
        .fetch(['--all'])
        // Copy build artifacts (viewer & demos) into the local repo
        .exec(copyFiles)
        // Stage all changes
        .add(['-A'])
        // Create a commit for the updated assets
        .commit('updated viewer & demos')
        // Push the commit to the remote repository
        .push();
} else {
    console.log('\n###', 'update repository');
    git()
        // Show Git command outputs in the console
        .outputHandler(log)
        // Fetch the latest changes from the remote
        .fetch(['--all'])
        // Reset local state to match origin/master (clean slate)
        .reset(['--hard', 'origin/master'])
        // Copy build artifacts (viewer & demos) into the local repo
        .exec(copyFiles)
        // Stage all changes
        .add(['-A'])
        // Create a commit for the updated assets
        .commit('updated viewer & demos')
        // Push the commit to the remote repository
        .push();
}