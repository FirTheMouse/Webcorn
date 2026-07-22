#define TESTING_UNIT_ONLY 1

#if TESTING_UNIT_ONLY
    #include "GDSL/mixos-acorn/Acorn-Core.hpp"
#else
    #include "web/Webcorn-Core.hpp"
#endif
//#include "GDSL/mixos-acorn/Acorn-Script.hpp"

#include <signal.h>
#include <execinfo.h>



#if !TESTING_UNIT_ONLY
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
#endif



std::string resolve(const std::string& current_file, const std::string& include_path) {
    std::string dir = current_file.substr(0, current_file.find_last_of("/"));
    std::string joined = dir + "/" + include_path;
    return std::filesystem::path(joined).lexically_normal().string();
}


list<std::string> system_includes;
void strip_pragmas_and_system_includes(std::string& s) {
    size_t pos = s.find("#pragma once");
    while (pos != std::string::npos) {
        size_t line_end = s.find("\n", pos);
        s.erase(pos, line_end - pos + 1);
        pos = s.find("#pragma once");
    }

    pos = s.find("#include <");
    while (pos != std::string::npos) {
        size_t last_ifdef = s.rfind("#ifdef", pos);
        size_t last_endif = s.rfind("#endif", pos);
        
        if(last_ifdef == std::string::npos || (last_endif != std::string::npos && last_endif > last_ifdef)) {
            size_t path_start = pos + 10;
            size_t path_end = s.find(">", path_start);
            
            std::string include = s.substr(path_start, path_end - path_start);
            system_includes.push_if_absent(include);
            
            size_t line_end = s.find("\n", path_end);
            s.erase(pos, line_end - pos + 1);
    
            pos = s.find("#include <", pos);
        } else {
            pos = s.find("#include <", pos + 1);
        }
    }
}

map<std::string,bool> included_paths;
std::string vendor_file(const std::string& input_path, bool is_first = true) {
    std::string s = readFile(input_path);
    strip_pragmas_and_system_includes(s);
    size_t pos = s.find("#include \"");
    while (pos != std::string::npos) {
        size_t path_start = pos + 10; //Len of '#include "'
        size_t path_end = s.find("\"", path_start);
        
        std::string path = s.substr(path_start, path_end - path_start);
        path = resolve(input_path,path);
        
        size_t line_end = s.find("\n", path_end);
        s.erase(pos, line_end - pos + 1); //Erase the line
        
        uint32_t offset = 0;
        if(!included_paths.hasKey(path)) {
            std::string vendored = vendor_file(path,false);
            s.insert(pos, vendored);
            offset = vendored.size();
            included_paths.put(path,true);
        }
        
        pos = s.find("#include \"", pos + offset);
    }

    if(is_first) {
        s = s.substr(s.find_first_not_of('\n'));

        for(auto i : system_includes) {
            s.insert(0,"#include <"+i+">\n");
        }
        s.insert(0,"#pragma once\n\n");
    
        included_paths.clear();
        system_includes.clear();
    }   

    return s;
}


int main(int argc, char* argv[]) {
    print("TEST START");

    #if !TESTING_UNIT_ONLY
        signal(SIGSEGV, crash_handler);
        signal(SIGABRT, crash_handler);
        #ifndef _WIN32
            signal(SIGBUS, crash_handler);
            signal(SIGPIPE, SIG_IGN);
        #endif
    #endif

    //writeFile("GDSL/export/acorn.hpp",vendor_file("web/Webcorn-Core.hpp"));

    #if TESTING_UNIT_ONLY    
        g_ptr<Acorn::Unit> u =  Acorn::make_unit<Acorn::Unit>();
        u->unit_label = "u";

        g_ptr<Acorn::Unit> p =  Acorn::make_unit<Acorn::Unit>();
        p->unit_label = "p";

        g_ptr<Acorn::Unit> c =  Acorn::make_unit<Acorn::Unit>();
        c->unit_label = "c";

        u->send_message("c,p","Hello from u!");
        c->send_message("p","Hey p");

        u->test_courier();
        p->test_courier();
        c->test_courier();
        print("Starting courier");

        g_ptr<Acorn::Unit> courier =  Acorn::make_unit<Acorn::Unit>();
        courier->become_courier();

        Log::Line timer; timer.start();
        while(true) {
            if(timer.time_s()>2) {
                print("Test concluded, dumping units");
                editTextFile("printout.txt",[](std::string& source){source+="\n\n========TEST FINISHED========\n\n";});

                print("Dumping u");
                u->dump_unit(true,"printout.txt",14);
                print("Dumping c");
                c->dump_unit(false,"printout.txt",14);
                print("Dumping p");
                p->dump_unit(false,"printout.txt",14);
                print("Dumping courier");
                courier->dump_unit(false,"printout.txt",14);
                courier->running = false;
                timer.end();
                break;
            }
        }
    #else 
        try {
            // g_ptr<Acorn::Acorn_Script> acorn =  Acorn::make_unit<Acorn::Acorn_Script>();
            // acorn->run(acorn->process(readFile("GDSL/mixos-acorn/test.gld")));

            g_ptr<Acorn::Webcorn_Core> webcorn =  Acorn::make_unit<Acorn::Webcorn_Core>();
            //webcorn->setup_trace_res_flipbook();
            bool in_debug = false;
            for(int i = 1; i < argc; i++) {
                std::string arg(argv[i]);
                webcorn->uargs << arg;
                if(arg=="--debug") in_debug = true;
            }
            if(!in_debug) {
                std::set_terminate([](){
                    fprintf(stderr, "std::terminate called!\n");
                    void* array[20];
                    size_t size = backtrace(array, 20);
                    backtrace_symbols_fd(array, size, STDERR_FILENO);
                    abort();
                });
            }
            webcorn->run(webcorn->process(readFile("web/webcorn.gld")));
            // webcorn->run(webcorn->process(readFile("GDSL/mixos-acorn/test.gld")));
        } catch(std::exception& e) {
            print("FATAL EXCEPTION: ", e.what());
        } catch(...) {
            print("FATAL UNKNOWN EXCEPTION");
        }
    #endif
   
    print("TEST FINISHED");
}