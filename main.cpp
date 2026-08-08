#define TESTING_UNIT_ONLY 0

#if TESTING_UNIT_ONLY
    #include "GDSL/mixos-acorn/Acorn-Core.hpp"
#else
    #include "web/Webcorn-Core.hpp"
#endif
// #include "GDSL/mixos-acorn/Acorn-Script.hpp"
// #include "GDSL/mixos-acorn/Acorn-Workshop.hpp"

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



namespace wub {
    std::function<void(uint32_t&, uint8_t)> djb2 = [](uint32_t& state, uint8_t c) {
        state = ((state << 5) + state) + c;
    };
    std::function<void(uint32_t&, uint8_t)> fnv1a = [](uint32_t& state, uint8_t c) {
        state = (state ^ c) * 16777619u;
    };
    std::function<void(uint32_t&, uint8_t)> sdbm = [](uint32_t& state, uint8_t c) {
        state = c + (state << 6) + (state << 16) - state;
    };
    std::function<void(uint32_t&, uint8_t)> bernstein = [](uint32_t& state, uint8_t c) {
        state = (state ^ (state >> 16)) * 0x45d9f3b + c;
    };

    inline void mixin(const std::string& s, uint32_t& state, const std::function<void(uint32_t&, uint8_t)>& mix) {
        for(char c : s) {mix(state, (uint8_t)c);}
    }

    //Goes clockwise
    inline uint32_t spin(uint32_t state, int by) {
        by = ((by % 32) + 32) % 32; //Normalizing out 0 and 32 and converting the sign
        if(by == 0) return 0;
        return (state << by) | (state >> (32 - by));
    }

    inline uint8_t zipper(uint8_t state, uint8_t left, uint8_t right) {return (state & left) | (~state & right);}
    inline uint32_t zipper(uint32_t state, uint32_t left, uint32_t right) {return (state & left) | (~state & right);}

    inline uint32_t parity(uint32_t b, uint32_t c, uint32_t d) {return b ^ c ^ d;}
    inline uint32_t majority(uint32_t b, uint32_t c, uint32_t d) {return (b & c) | (b & d) | (c & d);}

    uint32_t wub1(const std::string& key) {
        uint32_t state = 3;
        mixin("wub",state,djb2);
        print("STATE ",to_bin(state));
        uint32_t spn3 = spin(state,3);
        print("SPN 3 ",to_bin(spn3));
        uint32_t spn3n = spin(state,-3);
        print("SPN-3 ",to_bin(spn3n));
        uint32_t zipped = zipper(state,spn3n,spn3);
        print("ZIPPD ",to_bin(zipped));
        state = (state^zipped);
        print("STATE ",to_bin(state));
        return state;
    }

    void spincrypt(uint32_t& state, list<int>& ledger) {
        int r = randi(1,31);
        if(randi(0,1)) r = -r;
        state = spin(state,r);
        ledger << r;
    }   
    void spindecrypt(uint32_t& state, list<int>& ledger) {
        for(int i=ledger.length()-1;i>=0;i--) {
            state = spin(state, -ledger[i]);
        }
    }

    uint32_t wub2(const std::string& key) {
        // uint32_t state = 5381;
        // print("STATE ",to_bin(state));
        // uint8_t ledger = 0;
        // for(int i=0;i<8;i++) {
        //     int r = randi(0,1);
        //     mixin("wub",state,r==0?djb2:fnv1a);
        //     ledger = (ledger<<1)|((uint8_t)r);
        // }
        // print("LEDGR ",to_bin(ledger));
        // print("STATE ",to_bin(state));

        uint32_t state = 12345678;
        uint32_t original = state;
        list<int> ledger;

        print("BEFORE ", to_bin(state));
        spincrypt(state, ledger);
        spincrypt(state, ledger);
        spincrypt(state, ledger);
        print("ENCRYP ", to_bin(state));
        spindecrypt(state, ledger);
        print("DECRYP ", to_bin(state));
        print("MATCH  ", state == original ? "YES" : "NO");
        return state;
    }

    uint32_t sha1_f_round(int round, uint32_t b, uint32_t c, uint32_t d) {
        if(round < 20) return zipper(b, c, d);
        if(round < 40) return parity(b, c, d);
        if(round < 60) return majority(b, c, d);
        return parity(b, c, d);
    }
}


int main(int argc, char* argv[]) {
    print("TEST START");

    //wub::wub2("testing");




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
        // g_ptr<Acorn::Unit> u =  Acorn::make_unit<Acorn::Unit>();
        // u->test_pool_groups();

        // g_ptr<Acorn::Unit> u =  Acorn::make_unit<Acorn::Unit>();
        // u->unit_label = "u";

        // g_ptr<Acorn::Unit> p =  Acorn::make_unit<Acorn::Unit>();
        // p->unit_label = "p";

        // g_ptr<Acorn::Unit> c =  Acorn::make_unit<Acorn::Unit>();
        // c->unit_label = "c";

        // u->send_message("c,p","Hello from u!");
        // c->send_message("p","Hey p");

        // u->test_courier();
        // p->test_courier();
        // c->test_courier();
        // print("Starting courier");

        // g_ptr<Acorn::Unit> courier =  Acorn::make_unit<Acorn::Unit>();
        // courier->become_courier();

        // Log::Line timer; timer.start();
        // while(true) {
        //     if(timer.time_s()>2) {
        //         print("Test concluded, dumping units");
        //         editTextFile("printout.txt",[](std::string& source){source+="\n\n========TEST FINISHED========\n\n";});

        //         print("Dumping u");
        //         u->dump_unit(true,"printout.txt",14);
        //         print("Dumping c");
        //         c->dump_unit(false,"printout.txt",14);
        //         print("Dumping p");
        //         p->dump_unit(false,"printout.txt",14);
        //         print("Dumping courier");
        //         courier->dump_unit(false,"printout.txt",14);
        //         courier->running = false;
        //         timer.end();
        //         break;
        //     }
        // }
    #else 
        try {
            // g_ptr<Acorn::Workshop_Unit> acorn =  Acorn::make_unit<Acorn::Workshop_Unit>();
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
            webcorn->run(webcorn->process(readFile("GDSL/mixos-acorn/test.gld")));
        } catch(std::exception& e) {
            print("FATAL EXCEPTION: ", e.what());
        } catch(...) {
            print("FATAL UNKNOWN EXCEPTION");
        }
    #endif
   
    print("TEST FINISHED");
}