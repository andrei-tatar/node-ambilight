
export interface Settings {
    mqtt?: {
        user: string;
        password: string;
    };
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
    correction?: { a: number, b: number, gamma: number }[];
    coordinates: {
        top: Line;
        left: Line;
        bottom: Line;
        right: Line;
    };
}

export interface Point {
    x: number;
    y: number;
}

export interface Line {
    from: Point;
    to: Point;
    q: Point;
}

export interface Size {
    width: number;
    height: number;
}