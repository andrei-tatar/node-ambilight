import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject, combineLatest, interval } from 'rxjs';
import { shareReplay, map, first, switchMap, startWith } from 'rxjs/operators';

@Injectable()
export class ApiService {

    private settings$ = this.http
        .get<Settings>('api/settings')
        .pipe(shareReplay(1));

    coordinates$ = this.settings$.pipe(
        map(settings => {
            const subjects: SubjectProperties<Settings['coordinates']> = {} as any;
            for (const [key, value] of Object.entries(settings.coordinates)) {
                const typedKey: keyof Settings['coordinates'] = key as any;
                subjects[typedKey] = new BehaviorSubject<Point>({
                    x: value.x / 100 * settings.capture.size.width,
                    y: value.y / 100 * settings.capture.size.height,
                });
            }
            return subjects;
        }),
        shareReplay(1),
    );

    size$ = this.settings$.pipe(
        map(settings => settings.capture.size),
    );

    constructor(private http: HttpClient) {
    }

    save() {
        return combineLatest([this.coordinates$, this.settings$]).pipe(
            first(),
            switchMap(([coords, { capture: { size }, resolution }]) => {
                const entries = Object.entries(coords);
                const keys = entries.map(e => e[0]);
                const observables = entries.map(e => e[1]);
                return combineLatest(observables)
                    .pipe(
                        first(),
                        map(values => {
                            const coordinates: Settings['coordinates'] = {} as any;
                            for (const [index, key] of keys.entries()) {
                                const typedKey: keyof Settings['coordinates'] = key as any;
                                const value = values[index];
                                coordinates[typedKey] = {
                                    x: value.x / size.width * 100,
                                    y: value.y / size.height * 100,
                                };
                            }

                            const patch: Partial<Settings> = {
                                coordinates,
                                samplePoints: this.getSamplePoints(coordinates, resolution),
                            };

                            return patch;
                        })
                    );
            }),
            switchMap(coordinates => this.http.patch('api/settings', coordinates)),
        );
    }

    private getSamplePoints(coordinates: Settings['coordinates'], resolution: { horizontal: number, vertical: number }) {
        const samplePoints: Point[] = [];

        samplePoints.push(...this.getPathPoints(coordinates.topLeft, coordinates.topRight, coordinates.qTop, resolution.horizontal));
        samplePoints.push(...this.getPathPoints(coordinates.topRight, coordinates.bottomRight, coordinates.qRight, resolution.vertical));
        samplePoints.push(...this.getPathPoints(coordinates.bottomRight, coordinates.bottomLeft, coordinates.qBottom, resolution.horizontal));
        samplePoints.push(...this.getPathPoints(coordinates.bottomLeft, coordinates.topLeft, coordinates.qLeft, resolution.vertical));

        return samplePoints;
    }

    private getPathPoints(from: Point, to: Point, q: Point, resolution: number) {
        const path: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${from.x} ${from.y} Q ${q.x} ${q.y}, ${to.x} ${to.y}`)
        const length = path.getTotalLength();
        const points: Point[] = [];
        for (let i = 0; i < resolution; i++) {
            const point = path.getPointAtLength(i / (resolution - 1) * length);
            points.push({
                x: point.x,
                y: point.y,
            });
        }
        return points;
    }
}

type SubjectProperties<T> = {
    [P in keyof T]: Subject<T[P]>;
};

export interface Settings {
    capture: {
        size: Size;
        fps: number;
        device?: number | string;
    };
    resolution: {
        horizontal: number;
        vertical: number;
    };
    samplePoints: Point[];
    coordinates: {
        topLeft: Point,
        topRight: Point,
        bottomLeft: Point,
        bottomRight: Point,
        qTop: Point,
        qLeft: Point,
        qBottom: Point,
        qRight: Point,
    };
}

export interface Point {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}