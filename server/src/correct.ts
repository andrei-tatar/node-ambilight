import { MonoTypeOperatorFunction } from "rxjs";
import { map, withLatestFrom } from 'rxjs/operators';
import { configMap } from './settings';

function applyCorrection(arr: Uint8Array, offset: number, correction: { a: number, b: number, gamma: number }) {
    let value = arr[offset];
    value = value * correction.a + correction.b;
    if (value < 0) value = 0;
    if (value > 255) value = 255;
    // value = 255 * Math.pow(value / 255, correction.gamma);
    arr[offset] = 255 * Math.pow(value / 255, 2.2);
}

const correction$ = configMap(c => c.correction);

export function correctRange(): MonoTypeOperatorFunction<Uint8Array> {
    return source => source.pipe(
        withLatestFrom(correction$),
        map(([data, correction]) => {
            if (correction?.length === data.length) {
                data = data.slice(0);
                for (let i = 0; i < correction.length; i++) {
                    applyCorrection(data, i, correction[i]);
                }
            }
            return data;
        }),
    );
}
