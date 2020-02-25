
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