import { MonoTypeOperatorFunction } from 'rxjs';
import { scan, withLatestFrom } from 'rxjs/operators';

import { configMap } from './settings';

const ratio$ = configMap(c => c.blendRatio ?? .7);

export function blendSample(): MonoTypeOperatorFunction<Uint8Array> {
    return sample$ => sample$.pipe(
        withLatestFrom(ratio$),
        scan((prevSample, [sample, ratio]) => {
            if (prevSample.length !== sample.length) {
                prevSample = sample.slice();
            } else {
                for (let i = 0; i < sample.length; i++) {
                    prevSample[i] = prevSample[i] * ratio + sample[i] * (1 - ratio);
                }
            }
            return prevSample;
        }, new Uint8Array()),
    );
}