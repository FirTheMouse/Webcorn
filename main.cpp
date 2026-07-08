#include "web/Webcorn-Core.hpp"

#include <signal.h>
#include <execinfo.h>

#ifdef _WIN32
void crash_handler(int sig) {
    fprintf(stderr, "CRASH (signal %d)\n", sig);
    exit(1);
}
#else
void crash_handler(int sig) {
    void* array[20];
    size_t size = backtrace(array, 20);
    fprintf(stderr, "CRASH (signal %d):\n", sig);
    backtrace_symbols_fd(array, size, STDERR_FILENO);
    exit(1);
}
#endif

int main(int argc, char* argv[]) {
    print("TEST START");

    signal(SIGSEGV, crash_handler);
    signal(SIGABRT, crash_handler);
    #ifndef _WIN32
        signal(SIGBUS, crash_handler);
        signal(SIGPIPE, SIG_IGN);
    #endif
    // std::set_terminate([](){
    //     fprintf(stderr, "std::terminate called!\n");
    //     void* array[20];
    //     size_t size = backtrace(array, 20);
    //     backtrace_symbols_fd(array, size, STDERR_FILENO);
    //     abort();
    // });

    try {
        g_ptr<Acorn::Webcorn_Core> webcorn =  Acorn::make_unit<Acorn::Webcorn_Core>();
        //webcorn->setup_trace_res_flipbook();
        webcorn->run(webcorn->process(readFile("web/webcorn.gld")));
        //webcorn->run(webcorn->process(readFile("GDSL/mixos-acorn/test.gld")));
    } catch(std::exception& e) {
        print("FATAL EXCEPTION: ", e.what());
    } catch(...) {
        print("FATAL UNKNOWN EXCEPTION");
    }
    print("TEST FINISHED");
}