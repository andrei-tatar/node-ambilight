import { Input, Directive, HostBinding, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { Subject, Subscription, BehaviorSubject } from 'rxjs';
import { Point, Size } from './api.service';
import { switchMap, filter } from 'rxjs/operators';
import { isDefined } from './util';

@Directive({
  // tslint:disable-next-line: directive-selector
  selector: 'circle[point]',
})
export class PointDirective implements OnInit, OnDestroy {
  private subscription?: Subscription;
  private point$ = new BehaviorSubject<Subject<Point> | null>(null);

  @Input()
  set point(value: Subject<Point>) {
    this.point$.next(value);
  }

  @HostBinding('attr.cx')
  cx = 0;

  @HostBinding('attr.cy')
  cy = 0;

  @HostBinding('class.dragging')
  dragging = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private el: ElementRef,
  ) {
  }

  ngOnInit() {
    this.subscription = this.point$
      .pipe(
        filter(isDefined),
        switchMap(p => p),
      )
      .subscribe(p => {
        this.cx = p.x;
        this.cy = p.y;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  @HostListener('mousedown')
  onMouseDown() {
    this.dragging = true;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(ev: MouseEvent) {
    if (!this.dragging) { return; }

    const svg: SVGElement = this.el.nativeElement.parentElement;
    const client = svg.getBoundingClientRect();
    const x = ev.pageX - client.left;
    const y = ev.pageY - client.top;
    this.point$.value?.next({ x, y });
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.dragging = false;
  }
}
