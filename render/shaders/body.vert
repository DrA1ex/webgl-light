#version 300 es

uniform mat4 projection;

in vec2 point;

in vec2 size;
in vec2 position;
in vec4 color;

out vec4 o_color;

void main() {
    gl_Position = projection * vec4(position + point * size, 0, 1);
    o_color = color;
}