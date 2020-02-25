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

    this.calibrating = false
    this.cdr.markForCheck();

    const sampleSize = blacks[0].length;
    const correctionFactors = [];
    for (let i = 0; i < sampleSize; i++) {
      const black = blacks.reduce((l, sample) => l + sample[i], 0) / samples;
      const white = whites.reduce((l, sample) => l + sample[i], 0) / samples;
      const range = Math.max(1, white - black);
      correctionFactors.push({
        a: 255 / range,
        b: -black,
      });
    }
    await this.service.updateCorrection(correctionFactors).toPromise();
  }

  private delay(time: number) {
    return new Promise(r => setTimeout(r, time))
  }
}
