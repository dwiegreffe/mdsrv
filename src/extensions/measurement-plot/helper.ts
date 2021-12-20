// Graphic Gems
// II.2 Nice numbers for graph lables
export function loose_label(min: number, max: number) {
    const ntick = 8;
    const range = niceNum(max - min, false);
    const d = niceNum(range / (ntick - 1), true);
    const graphMin = Math.floor(min / d) * d;
    const graphMax = Math.ceil(max / d) * d;
    const nfrac = Math.max(-Math.floor(Math.log10(d)), 0);
    nfrac;

    const ticks = [];

    for (let i = graphMin; i < graphMax + 0.5 * d; i += d) {
        ticks.push(`${i.toFixed(nfrac)}`);
    }

    return ticks;
}

// Graphic Gems
// II.2 Nice numbers for graph lables
export function niceNum(x: number, round: boolean) {
    const exp = Math.floor(Math.log10(x));
    const f = x / Math.pow(10, exp);
    let nf;
    if (round) {
        if (f < 1.5) {
            nf = 1;
        } else if (f < 3) {
            nf = 2;
        } else if (f < 7) {
            nf = 5;
        } else {
            nf = 10;
        }
    } else {
        if (f <= 1.5) {
            nf = 1;
        } else if (f <= 2) {
            nf = 2;
        } else if (f <= 5) {
            nf = 5;
        } else {
            nf = 10;
        }
    }
    return nf * Math.pow(10, exp);
}