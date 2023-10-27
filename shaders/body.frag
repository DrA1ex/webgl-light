#version 300 es
precision highp float;

in vec4 o_color;
out vec4 out_color;

void main() {
    out_color = vec4(o_color.rgb * o_color.a, o_color.a);
}