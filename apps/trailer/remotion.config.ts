import { Config } from "@remotion/cli/config";

// H.264 + AAC en yuv420p: lo que LinkedIn (y cualquier reproductor) acepta sin recomprimir raro.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(13);
Config.setPixelFormat("yuv420p");
// La escena usa CSS pesado (desenfoques sobre vídeo): con ANGLE lo pinta la GPU.
Config.setChromiumOpenGlRenderer("angle");
