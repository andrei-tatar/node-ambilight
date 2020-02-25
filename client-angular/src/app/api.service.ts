import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { shareReplay, map, first, switchMap } from 'rxjs/operators';

@Injectable()
export class ApiService {

    private settings$ = this.http
        .get<Settings>('api/settings')
        .pipe(shareReplay(1));

    coordinates$ = this.settings$.pipe(
        map(settings => {
            const subjects: WatchLine<Lines> = {} as any;
            for (const [key, line] of Object.entries(settings.coordinates)) {
                const lineName: keyof Lines = key as any;
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
    }

    deviceSamples() {
        return this.http.get<number[]>('api/samples');
    }

    updateCorrection(correction: { a: number, b: number }[]) {
        return this.http.patch('api/settings', {
            correction,
        });
    }

    save() {
        return combineLatest([this.coordinates$, this.settings$]).pipe(
            first(),
            map(([coords, { capture: { size }, resolution }]) => {
                const coordinates: Lines = {} as any;
                for (const [key, value] of Object.entries(coords)) {
                    coordinates[key as any as keyof Lines] = {
                        from: this.convertPoint(value.from.value, size),
                        to: this.convertPoint(value.to.value, size),
                        q: this.convertPoint(value.q.value, size),
                    }
                }
                const patch: Partial<Settings> = {
                    coordinates,
                    samplePoints: this.getSamplePoints(coordinates, resolution),
                };

                return patch;
            }),
            switchMap(coordinates => this.http.patch('api/settings', coordinates)),
        );
    }

    private convertPoint(x: Point, size: Size): Point {
        return {
            x: x.x / size.width * 100,
            y: x.y / size.height * 100,
        };
    }

    private getSamplePoints(coordinates: Lines, resolution: { horizontal: number, vertical: number }) {
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

type WatchLine<T> = {
    [P in keyof T]: SubjectProperties<T[P]>;
}

type SubjectProperties<T> = {
    [P in keyof T]: BehaviorSubject<T[P]>;
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
    correction?: { a: number, b: number }[];
    coordinates: Lines;
}

export interface Lines {
    top: Line;
    left: Line;
    bottom: Line;
    right: Line;
    [name: string]: Line;
}

export interface Point {
    x: number;
    y: number;
}

export interface Line {
    from: Point;
    to: Point;
    q: Point;
    [name: string]: Point;
}


export interface Size {
    width: number;
    height: number;
}