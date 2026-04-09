# Volume Input Formats

## Summary
- This directory contains format-specific readers for volume packing.
- It exists to adapt external map formats to the generic packing pipeline.
- `../format.ts` selects and uses the providers defined here.
- The main extension point is adding another supported input format.

## What
- Implements source-format readers such as CCP4 and DSN6.
- Normalizes each format into the shared header/data contract expected by the packer.
- Keeps format quirks local to provider modules.
- Does not decide packing strategy or sampling policy.

## Why
- Different source formats have different headers, byte layouts, and metadata conventions.
- Isolating them here keeps the rest of the packer format-agnostic.
- This makes new input support additive rather than invasive.

## How
- **Use:** Add new providers here and register them through `../format.ts`.
- **Extend:** Convert source-specific headers and slice reads into the shared provider interface.
- **Integrate:** Leave block sizing and output layout decisions to the higher packing layer.
- **Watch out:** Do not leak format-specific assumptions into generic packer code unless all providers share them.
