import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { shareReplay, map, first, switchMap, retry, tap } from 'rxjs/operators';

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
                    x: value.x / 100 * settings.size.width,
                    y: value.y / 100 * settings.size.height,
                });
            }
            return subjects;
        }),
        shareReplay(1),
    );

    size$ = this.settings$.pipe(
        map(settings => settings.size),
    );

    constructor(private http: HttpClient) {
    }

    save() {
        return combineLatest([this.coordinates$, this.size$]).pipe(
            first(),
            switchMap(([coords, size]) => {
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
                            return coordinates;
                        })
                    );
            }),
            switchMap(coordinates => this.http.patch('api/settings/coordinates', coordinates)),
        );
    }
}

type SubjectProperties<T> = {
    [P in keyof T]: Subject<T[P]>;
};

interface Settings {
    size: Size;
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