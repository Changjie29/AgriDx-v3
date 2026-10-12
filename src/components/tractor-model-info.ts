// Lightweight metadata: importing a URL or type must not pull in the renderer.
import { publicAsset } from '../lib/public-asset';
export const TRACTOR_MODEL_URL = publicAsset('models/tractor-detailed-v1.glb');
export type TractorComponent = 'all' | 'body' | 'engine' | 'drivetrain' | 'hydraulics' | 'electrical' | 'wheels' | 'cab';
