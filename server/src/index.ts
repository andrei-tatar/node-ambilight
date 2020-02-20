import cv from 'opencv4nodejs';
import express from 'express';
import bodyParser from 'body-parser';

import { Observable, OperatorFunction, ReplaySubject } from 'rxjs';
import { bufferTime, map, publishReplay, refCount, first, switchMap } from 'rxjs/operators';

function getCaptureDevice(devicePort = 0): Observable<cv.VideoCapture> {
    return new Observable<cv.VideoCapture>(observer => {
        const capture = new cv.VideoCapture(devicePort);
        observer.next(capture);

        // capture.set(cv.CAP_PROP_SATURATION, .3);
        // capture.set(cv.CAP_PROP_BRIGHTNESS, .3);
        // capture.set(cv.CAP_PROP_CONTRAST, .3);
        // capture.set(cv.CAP_PROP_GAIN, .3);
        // capture.set(cv.CAP_PROP_EXPOSURE, .3);
        // capture.set(cv.CAP_PROP_AUTO_EXPOSURE, .3);

        return () => capture.release();
    });
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

const frames$ = getCaptureDevice()
    .pipe(
        getFrames(),
        publishReplay(1),
        refCount()
    );

const fps$ = new ReplaySubject<number>(1)
frames$.pipe(
    bufferTime(5000),
    map(frames => frames.length / 5),
).subscribe(fps$);

const app = express();
let coordinates = {
    topLeft: { x: 25, y: 25 },
    topRight: { x: 75, y: 25 },
    bottomLeft: { x: 25, y: 75 },
    bottomRight: { x: 75, y: 75 },
    qTop: { x: 50, y: 25 },
    qLeft: { x: 25, y: 50 },
    qBottom: { x: 50, y: 75 },
    qRight: { x: 75, y: 50 },
};
app.use(bodyParser.json());
app.get('/fps', async (_req, res) => {
    const fps = await fps$.pipe(first()).toPromise();
    res.json(fps);
});
app.get('/frame', async (_req, res) => {
    const frame = await frames$.pipe(first()).toPromise();
    const buffer = await cv.imencodeAsync('.png', frame);
    res.type('png').end(buffer);
});
app.get('/settings', async (_req, res) => {
    const frame = await frames$.pipe(first()).toPromise();
    res.json({
        size: {
            width: frame.sizes[1],
            height: frame.sizes[0],
        },
        coordinates,
    });
});
app.patch('/settings/coordinates', async (req, res) => {
    coordinates = req.body;
    res.status(204).send();
});
app.use(express.static('./src/client'));

const server = app.listen(3000);

process.on('SIGINT', () => {
    server.close();
    fps$.unsubscribe();
});
