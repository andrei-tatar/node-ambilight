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

  async calibrate() {
    const samples = 10;

    this.calibrating = true;

    const blacks = await this.getSamples('black', samples);
    const whites = await this.getSamples('white', samples);
    const grays = await this.getSamples('#7f7f7f', samples);

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
      const gamma = Math.log(127 / 255) / Math.log(rangedGray / 255);
      correctionFactors.push({ a, b, gamma });
    }
    await this.service.updateCorrection(correctionFactors).toPromise();

    (window as any).correctionFactors = correctionFactors;
  }

  private async getSamples(color: string, count: number) {
    this.color = color;
    this.cdr.markForCheck();
    await this.delay(100);
    const samples = [];
    for (let i = 0; i < count; i++) {
      const sample = await this.service.deviceSamples().toPromise();
      samples.push(sample);
    }
    return samples;
  }

  private delay(time: number) {
    return new Promise(r => setTimeout(r, time))
  }
}
