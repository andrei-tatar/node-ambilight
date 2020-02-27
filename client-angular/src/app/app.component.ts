import { Component, ChangeDetectionStrategy, OnInit, ChangeDetectorRef } from '@angular/core';
import { ApiService } from './api.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {

  coordinates$ = this.service.coordinates$;
  size$ = this.service.size$;

  calibrating = false;
  color?: string;

  constructor(
    private service: ApiService,
    private cdr: ChangeDetectorRef,
  ) {
  }

  ngOnInit() {
  }

  save() {
    this.service.save().toPromise();
  }

  async calibrate() {
    const samples = 40;
    const blacks: number[][] = [];
    const whites: number[][] = [];
    const grays: number[][] = [];

    this.calibrating = true;
    this.color = 'black';

    await this.delay(2000);
    for (let i = 0; i < samples; i++) {
      const sample = await this.service.deviceSamples().toPromise();
      blacks.push(sample);
      await this.delay(50);
    }

    this.color = 'white';
    this.cdr.markForCheck();
    await this.delay(2000);

    for (let i = 0; i < samples; i++) {
      const sample = await this.service.deviceSamples().toPromise();
      whites.push(sample);
      await this.delay(50);
    }

    this.color = '#7f7f7f';
    this.cdr.markForCheck();
    await this.delay(2000);

    for (let i = 0; i < samples; i++) {
      const sample = await this.service.deviceSamples().toPromise();
      grays.push(sample);
      await this.delay(50);
    }

    this.calibrating = false
    this.cdr.markForCheck();

    const sampleSize = blacks[0].length;
    const correctionFactors = [];
    for (let i = 0; i < sampleSize; i++) {
      const black = blacks.reduce((l, sample) => l + sample[i], 0) / samples;
      const white = whites.reduce((l, sample) => l + sample[i], 0) / samples;
      const gray = grays.reduce((l, sample) => l + sample[i], 0) / samples;
      const range = Math.max(1, white - black);
      const a = 255 / range;
      const b = -black;
      const rangedGray = a * gray + b;
      const gamma = 1 / (Math.log(127 / 255) / Math.log(rangedGray / 255));
      correctionFactors.push({ a, b, gamma });
      console.log(black, white, gray, rangedGray, gamma);
    }
    await this.service.updateCorrection(correctionFactors).toPromise();

    (window as any).correctionFactors = correctionFactors;
  }

  private delay(time: number) {
    return new Promise(r => setTimeout(r, time))
  }
}
