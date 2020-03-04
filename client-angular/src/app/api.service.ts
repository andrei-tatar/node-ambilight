import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { shareReplay, map, switchMap, skip, debounceTime } from 'rxjs/operators';

@Injectable()
export class ApiService {
    private settings$ = this.http
        .get<Settings>('api/settings')
        .pipe(shareReplay(1));

    coordinates$ = this.settings$.pipe(
        map(settings => {
            const subjects: WatchLine<Coordinates> = {} as any;
            for (const [key, line] of Object.entries(settings.coordinates)) {
                const lineName: keyof Coordinates = key as any;
                subjects[lineName] = {} as any;

                for (const [pointName, point] of Object.entries(line)) {
                    const pointKey: keyof Line = pointName as any;
                    subjects[lineName][pointKey] = new BehaviorSubject<Point>({
                        x: point.x / 100 * settings.capture.size.width,
                        y: point.y / 100 * settings.capture.size.height,
                    });
                }
            }
            return subjects;
        }),
        shareReplay(1),
    );

    size$ = this.settings$.pipe(
        map(settings => settings.capture.size),
    );

    constructor(private http: HttpClient) {
        combineLatest([this.coordinates$, this.settings$]).pipe(
            switchMap(([coords, { capture: { size }, resolution }]) => {
                const entries: Observable<Partial<Coordinates>>[] = [];
                for (const [key, value] of Object.entries(coords)) {
                    const update = combineLatest([value.from, value.to, value.q]).pipe(
                        map(([from, to, q]) => {
                            return {
                                [key]: {
                                    from: this.convertPoint(from, size),
                                    to: this.convertPoint(to, size),
                                    q: this.convertPoint(q, size),
                                }
                            };
                        }));
                    entries.push(update);
                }

                const coordinates$ = combineLatest(entries)
                    .pipe(
                        skip(1),
                        debounceTime(3000),
                        map(updates => updates.reduce((last, c) => ({ ...last, ...c }), {})),
                        map((coordinates: any) => {
                            const patch: Partial<Settings> = {
                                coordinates,
                                samplePoints: this.getSamplePoints(coordinates, resolution),
                            };
                            return patch;
                        })
                    );

                return coordinates$;
            }),

            switchMap(coordinates => this.http.patch('api/settings', coordinates)),
        ).subscribe();
    }

    deviceSamples() {
        return this.http.get<number[]>(`api/samples?i=${new Date().getTime()}`);
    }

    updateCorrection(correction: { a: number, b: number }[]) {
        return this.http.patch('api/settings', {
            correction,
        });
    }

    private convertPoint(x: Point, size: Size): Point {
        return {
            x: x.x / size.width * 100,
            y: x.y / size.height * 100,
        };
    }

    private getSamplePoints(coordinates: Coordinates, resolution: { horizontal: number, vertical: number }) {
        const samplePoints: Point[] = [];

        samplePoints.push(...this.getPathPoints(coordinates.top, resolution.horizontal));
        samplePoints.push(...this.getPathPoints(coordinates.right, resolution.vertical));
        samplePoints.push(...this.getPathPoints(coordinates.bottom, resolution.horizontal));
        samplePoints.push(...this.getPathPoints(coordinates.left, resolution.vertical));

        return samplePoints;
    }

    private getPathPoints({ from, to, q }: Line, resolution: number) {
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

type Coordinates = { [name: string]: Line };

type WatchLine<T> = {
    [P in keyof T]: SubjectProperties<T[P]>;
}

type SubjectProperties<T> = {
    [P in keyof T]: BehaviorSubject<T[P]>;
};

export interface Settings {
    mqtt?: {
        user: string;
        password: string;
        endpoint: string;
        topic: string;
        onvalue: string;
    };
    capture: {
        size: Size;
        fps: number;
        device?: number | string;
    };
    resolution: {
        horizontal: number;
        vertical: number;
    };
    coordinates: {
        top: Line;
        left: Line;
        bottom: Line;
        right: Line;
    };
    samplePoints: Point[];
    correction?: { a: number, b: number }[];
    blendRatio: number;
    updater?: {
        type: 'websocket',
        endpoint: string;
    };
    interpolate?: boolean;
    gamma: [number, number, number];
}

export interface Point {
    x: number;
    y: number;
}

export interface Line {
    from: Point;
    to: Point;
    q: Point;
}

export interface Size {
    width: number;
    height: number;
}