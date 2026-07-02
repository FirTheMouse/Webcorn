#include "web/Webcorn-Core.hpp"
int main(int argc, char* argv[]) {
    print("TEST START");

    g_ptr<Acorn::Webcorn_Core> webcorn =  Acorn::make_unit<Acorn::Webcorn_Core>();
    //webcorn->setup_trace_res_flipbook();
    webcorn->run(webcorn->process(readFile("web/webcorn.gld")));
}