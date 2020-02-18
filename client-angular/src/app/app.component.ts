import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
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

  constructor(private service: ApiService) {
  }

  ngOnInit() {
  }
}
