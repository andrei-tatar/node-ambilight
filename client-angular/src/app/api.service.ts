import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { shareReplay, map } from 'rxjs/operators';

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