#include <GDSL/core/Golden.hpp>
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h> 
#include <signal.h>

int main(int argc, char* argv[]) {
    std::string process = "";
    for(int i = 1; i < argc; i++) {
        std::string arg(argv[i]);
        if(i==1) {
            process = arg;
        } else {

        }
    }

    char** process_args = argv + 1;
    uint32_t restarts = 0;

    Log::Line l;
    while(true) {
        l.start();
        pid_t pid = fork();
        if(pid < 0) {
            print("Hazel fork() failed");
            return 1;
        }
        if(pid == 0) {
            execv(process_args[0], process_args);
            print("Hazel execv() failed");
            exit(1);
        }
        print("Hazel launched ",process," with pid ", pid);

        int status;
        waitpid(pid, &status, 0);

        double uptime = l.end();

        if(WIFEXITED(status)) {
            int code = WEXITSTATUS(status);
            if(code == 0) {
                print("Hazel clean exit, shutting  down");
                return 0;
            }
            print("Hazel exited with code ",code," after ",ftime(uptime));
        } else if(WIFSIGNALED(status)) {
            print("Hazel killed by signal ",WTERMSIG(status)," after ",ftime(uptime));
        }

        restarts++;
        print("Hazel has restarted ",restarts," times");

        if(uptime < 2000000000) {
            print("Hazel startup crash detected, backing off for 3s");
            sleep(3);
        }
    }
}