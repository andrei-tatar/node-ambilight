import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';

import { AppComponent } from './app.component';
import { ApiService } from './api.service';
import { PointDirective } from './point.directive';
import { PathDataPipe } from './path-data.pipe';

@NgModule({
  schemas: [NO_ERRORS_SCHEMA],
  declarations: [
    AppComponent, PointDirective, PathDataPipe
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
  ],
  providers: [ApiService],
  bootstrap: [AppComponent]
})
export class AppModule { }
