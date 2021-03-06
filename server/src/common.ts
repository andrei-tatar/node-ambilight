export interface Settings {
    mqtt?: {
        user: string;
        password: string;
        endpoint: string;
        topic: string;
        onvalue: string;
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
    coordinates: {
        top: Line;
        left: Line;
        bottom: Line;
        right: Line;
    };
    samplePoints: Point[];
    correction?: { a: number, b: number }[];
    blendRatio: number;
    updater?: {
        type: 'websocket',
        endpoint: string;
    };
    interpolate?: boolean;
    gamma: [number, number, number];
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