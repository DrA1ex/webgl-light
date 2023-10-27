#version 300 es

uniform mat4 projection;
uniform uint effect;
uniform vec2 resolution;

in vec2 point;

in vec2 size;
in vec2 position;
in vec4 color;

out vec4 o_color;
out vec2 text_coord;
out vec2 o_resolution;
flat out uint o_effect;

void main() {
    gl_Position = projection * vec4(position + point * size, 0, 1);
    o_color = color;

    text_coord = (gl_Position.xy + 1.0) / 2.0;
    o_effect = effect;
    o_resolution = resolution;
}