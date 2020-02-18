import { Pipe, PipeTransform } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { Point } from './api.service';
import { debounceTime, map } from 'rxjs/operators';

@Pipe({ name: 'pathData' })
export class PathDataPipe implements PipeTransform {
    transform(from$: Observable<Point>, to$: Observable<Point>, q$: Observable<Point>): Observable<string> {
        return combineLatest([from$, to$, q$])
            .pipe(
                debounceTime(0),
                map(([from, to, q]) => {
                    return `M ${from.x} ${from.y} Q ${q.x} ${q.y}, ${to.x} ${to.y}`;
                }),
            );
    }
}