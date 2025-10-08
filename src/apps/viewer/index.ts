/**
 * Copyright (c) 2018-2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

// Viewer bundle entry point.
// Note: the following "bare" imports are intentional; they have side effects for the bundler (e.g., webpack)
// and make sure the referenced static assets are copied to the output and available at runtime.

// Include an alternative embedded HTML document (e.g., for iframe/embed usage).
import './embedded.html';

// Include the favicon asset in the build output.
import './favicon.ico';

// Include the main HTML document of the viewer application.
import './index.html';

// Load the light theme of the Mol* Plugin UI (Sass will be compiled during the build).
require('mol-plugin-ui/skin/light.scss');

// Re-export the public API of the viewer app (e.g., initialization helpers, types, constants).
export * from './app';
