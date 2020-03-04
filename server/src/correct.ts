import { MonoTypeOperatorFunction } from "rxjs";
import { map, withLatestFrom } from 'rxjs/operators';
import { configMap } from './settings';

function applyCorrection(arr: Uint8Array, offset: number, gamma: number, correction: { a: number, b: number }) {
    let value = arr[offset];
    value = value * correction.a + correction.b;
    if (value < 0) value = 0;
    if (value > 255) value = 255;
    arr[offset] = 255 * Math.pow(value / 255, gamma);
}

const correction$ = configMap(({ correction, gamma }) => ({ correction, gamma }));

export function correctRange(): MonoTypeOperatorFunction<Uint8Array> {
    return source => source.pipe(
        withLatestFrom(correction$),
        map(([data, { correction, gamma }]) => {
            if (correction?.length === data.length) {
                data = data.slice(0);
                for (let i = 0; i < correction.length; i++) {
                    applyCorrection(data, i, gamma[i % 3], correction[i]);
                }
            }
            return data;
        }),
    );
}
