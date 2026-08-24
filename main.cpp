#define TESTING_UNIT_ONLY 0
#define TESTING_LANGUGE_ONLY 1

#if TESTING_UNIT_ONLY
    #if TESTING_LANGUGE_ONLY
        #include "GDSL/mixos-acorn/Acorn-Compiler.hpp"
    #else
        #include "GDSL/mixos-acorn/Acorn-Core.hpp"
    #endif
#else
    #if TESTING_LANGUGE_ONLY
        #include "GDSL/mixos-acorn/Acorn-Workshop.hpp"
    #else
      #include "web/Webcorn-Core.hpp"
    #endif
#endif

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

// list<map<std::string,std::string>> propbin;

// void test_memory(int depth = 0) {
//     //print("Test  mem ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
//     map<std::string,std::string> structural_props;
//     map<std::string,std::string> stylistic_props;
//     map<std::string,std::string> part_props;
    
//     //print("Befor puh ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
//     propbin.push(std::move(structural_props)); 
//     propbin.push(std::move(stylistic_props)); 
//     propbin.push(std::move(part_props));
//     //print("After puh ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
    
//     // propbin[propbin.length()-3].put("id","some-element-id");
//     // propbin[propbin.length()-3].put("class","race_display");
//     // propbin[propbin.length()-3].put("onclick","event.stopPropagation(); const candidates = this.parentElement...");
//     // propbin[propbin.length()-2].put("display","flex");
//     // propbin[propbin.length()-2].put("flex-direction","column");
//     // propbin[propbin.length()-2].put("background-color","rgb(43,43,43)");
//     // propbin[propbin.length()-1]["ANY"] += "some accumulated html content here";

//     if(depth<4) {
//         test_memory(depth+1);
//     }

//     //print("Befor pop ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
//     part_props = propbin.pop();
//     stylistic_props = propbin.pop(); 
//     structural_props = propbin.pop(); 
//     //print("After pop ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
//     //print("Done  mem ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
// }

// using namespace Acorn;

// // void test_memory() {
// //     //ColCol probs;
// //     std::vector<int> probs;
// //     probs.reserve(1);
// //         // QCellCol cells;
// //         //QCol c;
// //         // c.element_size = 1;
// //         // c.tag = 20; // char_id
// //         // std::string key = "hello";
// //         // c.hash = hashBytes(key.data(), key.size());
// //         // c.index = 0;
// //         // c.push((void*)key.data()); // store the key as data
// //     //probs.push_back(0);
// //         // cells.scan_for_slot(std::move(c));
// //         // c.storage = nullptr; // transfer ownership
// //         // // cells now owns the CCol with its storage
// //         // // destructor should free it
// // }

// ColCol propbin;

// void test_memory(int depth = 0) {
//     //print("Test  mem ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
//     create_column(propbin,sizeof(Ptr),string_id);
//     create_column(propbin,sizeof(Ptr),string_id);
//     create_column(propbin,sizeof(Ptr),string_id);

//     propbin[propbin.length()-3].put("id",&deadptr);
//     propbin[propbin.length()-3].put("class",&deadptr);
//     propbin[propbin.length()-3].put("onclick",&deadptr);
//     propbin[propbin.length()-2].put("display",&deadptr);
//     propbin[propbin.length()-2].put("flex-direction",&deadptr);
//     propbin[propbin.length()-2].put("background-color",&deadptr);
//     //propbin[propbin.length()-1]["ANY"] += "some accumulated html content here";

//     if(depth<4) {
//         test_memory(depth+1);
//     }

//     //print("Befor pop ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
//     int plen = propbin.length();
//     recycle_column(propbin,plen-1);
//     recycle_column(propbin,plen-2);
//     recycle_column(propbin,plen-3);
//     //print("After pop ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
//     //print("Done  mem ",depth," RSS: ",current_rss()," VSZ: ",current_vsz());
// }


// struct EmptyTest {
//     QCellCol qcol;
// };
// std::vector<EmptyTest> propbin;
// void test_memory(int depth = 0) {
//     EmptyTest structural_props;
//     EmptyTest stylistic_props;
//     EmptyTest part_props;
    
//     propbin.push_back(structural_props); 
//     propbin.push_back(stylistic_props); 
//     propbin.push_back(part_props);

//     if(depth<4) {
//         test_memory(depth+1);
//     }

//     part_props = propbin.back(); propbin.pop_back();
//     stylistic_props = propbin.back(); propbin.pop_back();
//     structural_props = propbin.back(); propbin.pop_back();
// }

// std::vector<std::unordered_map<std::string,std::string>> std_propbin;

// void test_memory_std(int depth = 0) {
//     std::unordered_map<std::string,std::string> structural_props;
//     std::unordered_map<std::string,std::string> stylistic_props;
//     std::unordered_map<std::string,std::string> part_props;
    
//     std_propbin.push_back(std::move(structural_props)); 
//     std_propbin.push_back(std::move(stylistic_props)); 
//     std_propbin.push_back(std::move(part_props));

//     std_propbin[std_propbin.size()-3]["id"] = "some-element-id";
//     std_propbin[std_propbin.size()-3]["class"] = "race_display";
//     std_propbin[std_propbin.size()-3]["onclick"] = "event.stopPropagation(); const candidates = this.parentElement...";
//     std_propbin[std_propbin.size()-2]["display"] = "flex";
//     std_propbin[std_propbin.size()-2]["flex-direction"] = "column";
//     std_propbin[std_propbin.size()-2]["background-color"] = "rgb(43,43,43)";
//     std_propbin[std_propbin.size()-1]["ANY"] += "some accumulated html content here";
    
//     if(depth<4) {
//         test_memory_std(depth+1);
//     }

//     part_props = std::move(std_propbin.back()); std_propbin.pop_back();
//     stylistic_props = std::move(std_propbin.back()); std_propbin.pop_back();
//     structural_props = std::move(std_propbin.back()); std_propbin.pop_back();
// }

// list<EmptyTest> propbin;
// void test_memory(int depth = 0) {
//     EmptyTest structural_props;
//     EmptyTest stylistic_props;
//     EmptyTest part_props;
    
//     propbin.push(structural_props); 
//     propbin.push(stylistic_props); 
//     propbin.push(part_props);

//     if(depth<4) {
//         test_memory(depth+1);
//     }

//     part_props = propbin.last(); propbin.pop();
//     stylistic_props = propbin.last(); propbin.pop();
//     structural_props = propbin.last(); propbin.pop();
// }

int main(int argc, char* argv[]) {
    print("TEST START");

    //wub::wub2("testing");




    #if !TESTING_UNIT_ONLY
        // signal(SIGSEGV, crash_handler);
        // signal(SIGABRT, crash_handler);
        #ifndef _WIN32
            signal(SIGBUS, crash_handler);
            signal(SIGPIPE, SIG_IGN);
        #endif
    #endif

    //writeFile("GDSL/export/acorn.hpp",vendor_file("web/Webcorn-Core.hpp"));

    #if TESTING_UNIT_ONLY  
        #if TESTING_LANGUGE_ONLY
            g_ptr<Acorn::Compiler_Unit> u =  Acorn::make_unit<Acorn::Compiler_Unit>();
            u->test_compiler();
        #else
            // size_t start_rss; size_t start_vsz;
            // size_t last_rss; size_t last_vsz;
            // int iters = 500000;
            // for(int i=0;i<iters;i++) {
            //     test_memory();
            //     if(i==0) {
            //         start_rss = current_rss();
            //         start_vsz = current_vsz();
            //         last_rss = current_rss();
            //         last_vsz = current_vsz();
            //     } else if(i%10000==0) {
            //         print("Growth over 10000 iteration(s), RSS: ",fmem(current_rss()-last_rss)," VSZ: ",fmem(current_vsz()-last_vsz));
            //         last_rss = current_rss();
            //         last_vsz = current_vsz();
            //     }
            // }
            // print("Growth over ",iters," iterations, RSS: ",fmem(current_rss()-start_rss)," VSZ: ",fmem(current_vsz()-start_vsz));

    
            g_ptr<Acorn::Unit> u =  Acorn::make_unit<Acorn::Unit>();
            u->test_pool_groups();

            // g_ptr<Acorn::Unit> u =  Acorn::make_unit<Acorn::Unit>();
            // u->unit_label = "u";

            // g_ptr<Acorn::Unit> p =  Acorn::make_unit<Acorn::Unit>();
            // p->unit_label = "p";

            // g_ptr<Acorn::Unit> c =  Acorn::make_unit<Acorn::Unit>();
            // c->unit_label = "c";

            // g_ptr<Thread> tt = make<Thread>();
            // tt->run([](){
            //     g_ptr<Acorn::Unit> e =  Acorn::make_unit<Acorn::Unit>();
            //     print("Made unit ",e->uid);
            // },0.000001f);
            // g_ptr<Thread> gg = make<Thread>();
            // gg->run([](){
            //     g_ptr<Acorn::Unit> e =  Acorn::make_unit<Acorn::Unit>();
            //     print("Also made unit ",e->uid);
            // },0.000001f);

            // Log::Line timer; timer.start();
            // while(true) {
            //     if(timer.time_s()>2) {
            //         print("Test concluded");
            //         break;
            //     }
            // }

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
        #endif 
    #else 
        try {
            #if TESTING_LANGUGE_ONLY
                g_ptr<Acorn::Workshop_Unit> acorn =  Acorn::make_unit<Acorn::Workshop_Unit>();
                acorn->run(acorn->process(readFile("GDSL/mixos-acorn/test.gld")));
            #else
                g_ptr<Acorn::Webcorn_Core> webcorn =  Acorn::make_unit<Acorn::Webcorn_Core>();
                //list<g_ptr<Acorn::Webcorn_Core>> webcorns;

                //webcorn->setup_trace_res_flipbook();
                bool in_debug = false;
                for(int i = 1; i < argc; i++) {
                    std::string arg(argv[i]);
                    webcorn->uargs << arg;
                    if(arg=="--debug") in_debug = true;
                    // if(arg=="--units") {
                    //     int amt = std::stoi(arg.substr(7));
                    //     for(int i=0;i<6;i++) {
                    //         g_ptr<Acorn::Webcorn_Core> new_unit = Acorn::make_unit<Acorn::Webcorn_Core>();
                    //         new_unit->uargs << webcorn->uargs;
                    //         webcorns << new_unit;
                    //     }
                    // }
                }
                if(!in_debug) {
                    // std::set_terminate([](){
                    //     fprintf(stderr, "std::terminate called!\n");
                    //     void* array[20];
                    //     size_t size = backtrace(array, 20);
                    //     backtrace_symbols_fd(array, size, STDERR_FILENO);
                    //     abort();
                    // });
                }
                // for(auto& unit : webcorns) {
                //     unit->start_thread([unit](){
                //         unit->run(unit->process(readFile("web/webcorn.gld")));
                //     });
                // }
                webcorn->run(webcorn->process(readFile("web/webcorn.gld")));
                //webcorn->run(webcorn->process(readFile("GDSL/mixos-acorn/test.gld")));
            #endif
        } catch(std::exception& e) {
            print("FATAL EXCEPTION: ", e.what());
        } catch(...) {
            print("FATAL UNKNOWN EXCEPTION");
        }
    #endif
   
    print("TEST FINISHED");
}