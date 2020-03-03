import cv from 'opencv4nodejs';
import { Observable, OperatorFunction } from 'rxjs';
import { publish, refCount, switchMap } from 'rxjs/operators';

import { configMap } from "./settings";

const captureSettings$ = configMap(s => s.capture);

function getCaptureDevice(): Observable<cv.VideoCapture> {
    return captureSettings$.pipe(
        switchMap(({ size, fps, device }) => new Observable<cv.VideoCapture>(observer => {
            const capture = typeof device === 'string' ?
                new cv.VideoCapture(device) :
                new cv.VideoCapture(device ?? 0);

            capture.set(cv.CAP_PROP_FRAME_WIDTH, size.width);
            capture.set(cv.CAP_PROP_FRAME_HEIGHT, size.height);
            capture.set(cv.CAP_PROP_FPS, fps);
            observer.next(capture);

            console.info(`capture start ${size.width}x${size.height} at ${fps}`);

            return () => capture.release();
        })),
    );
}

function getFrames(): OperatorFunction<cv.VideoCapture, cv.Mat> {
    return source => source.pipe(
        switchMap(device => new Observable<cv.Mat>(observer => {
            let stop = false;

            async function captureFrame() {
                try {
                    const frame = await device.readAsync();
                    if (!frame.empty) observer.next(frame);
                    if (!stop) captureFrame();
                } catch (err) {
                    observer.error(err);
                }
            }

            captureFrame();
            return () => stop = true;
        }))
    );
}

export const frames$ = getCaptureDevice()
    .pipe(
        getFrames(),
        publish(),
        refCount()
    );
