#include <windows.h>
#include <iostream>

int main(int argc, char* argv[]) {
    if (argc < 3) {
        return 1;
    }

    int dx = atoi(argv[1]);
    int dy = atoi(argv[2]);

    INPUT input;
    input.type = INPUT_MOUSE;
    input.mi.dx = dx;
    input.mi.dy = dy;
    input.mi.mouseData = 0;
    input.mi.dwFlags = MOUSEEVENTF_MOVE;  // raw relative mouse delta
    input.mi.time = 0;
    input.mi.dwExtraInfo = 0;

    SendInput(1, &input, sizeof(INPUT));

    return 0;
}
