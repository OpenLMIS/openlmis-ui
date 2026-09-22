pipeline {
    agent any
    options {
        buildDiscarder(logRotator(
            numToKeepStr: env.BRANCH_NAME.equals("master") ? '15' : '3',
            daysToKeepStr: env.BRANCH_NAME.equals("master") || env.BRANCH_NAME.startsWith("rel-") ? '' : '7',
            artifactDaysToKeepStr: env.BRANCH_NAME.equals("master") || env.BRANCH_NAME.startsWith("rel-") ? '' : '3',
            artifactNumToKeepStr: env.BRANCH_NAME.equals("master") || env.BRANCH_NAME.startsWith("rel-") ? '' : '1'
        ))
        disableConcurrentBuilds()
        skipStagesAfterUnstable()
    }
    environment {
        PATH = "/usr/local/bin/:$PATH"
        IMAGE = "openlmis/openlmis-ui"
        // Compiled into asset URLs, so the published image is tied to this prefix.
        BASE_PATH = "/v2"
    }
    stages {
        stage('Preparation') {
            steps {
                checkout scm

                withCredentials([usernamePassword(
                    credentialsId: "cad2f741-7b1e-4ddd-b5ca-2959d40f62c2",
                    usernameVariable: "USER",
                    passwordVariable: "PASS"
                )]) {
                    sh 'set +x'
                    sh 'docker login -u $USER -p $PASS'
                }
                script {
                    def properties = readProperties file: 'project.properties'
                    if (!properties.version) {
                        error("version property not found")
                    }
                    VERSION = properties.version
                    currentBuild.displayName += " - " + VERSION
                }
            }
            post {
                failure {
                    script {
                        notifyAfterFailure()
                    }
                }
            }
        }
        stage('Verify') {
            steps {
                // Same image contents the release is built from, so a failure here
                // means the artifact would have been broken.
                sh 'docker build --target verify --build-arg BASE_PATH=$BASE_PATH .'
            }
            post {
                failure {
                    script {
                        notifyAfterFailure()
                    }
                }
            }
        }
        stage('Build') {
            steps {
                script {
                    sh "docker build --build-arg BASE_PATH=$BASE_PATH -t ${IMAGE}:${VERSION} ."
                }
            }
            post {
                failure {
                    script {
                        notifyAfterFailure()
                    }
                }
                cleanup {
                    sh "docker image prune -f --filter label=stage=build || true"
                }
            }
        }
        stage('Push image') {
            when {
                expression {
                    return env.GIT_BRANCH == 'master' || env.GIT_BRANCH =~ /rel-.+/
                }
            }
            steps {
                script {
                    sh "docker push ${IMAGE}:${VERSION}"
                }
            }
            post {
                success {
                    script {
                        if (!VERSION.endsWith("SNAPSHOT")) {
                            currentBuild.setKeepLog(true)
                        }
                    }
                }
                failure {
                    script {
                        notifyAfterFailure()
                    }
                }
            }
        }
    }
    post {
        fixed {
            script {
                BRANCH = "${env.GIT_BRANCH}".trim()
                if (BRANCH.equals("master") || BRANCH.startsWith("rel-")) {
                    slackSend color: 'good', message: "${env.JOB_NAME} - #${env.BUILD_NUMBER} Back to normal"
                }
            }
        }
        // No deploy is triggered on purpose. OpenLMIS-3.x-deploy-to-test removes every
        // container and image before recreating, taking the whole test environment
        // down for a full re-pull, so it is run deliberately rather than on merge. It
        // pulls every service at the version pinned in test_env/.env, ours included.
    }
}

def notifyAfterFailure() {
    messageColor = 'danger'
    if (currentBuild.result == 'UNSTABLE') {
        messageColor = 'warning'
    }
    BRANCH = "${env.GIT_BRANCH}".trim()
    if (BRANCH.equals("master") || BRANCH.startsWith("rel-")) {
        slackSend color: "${messageColor}", message: "${env.JOB_NAME} - #${env.BUILD_NUMBER} ${env.STAGE_NAME} ${currentBuild.result} (<${env.BUILD_URL}|Open>)"
    }
    emailext subject: "${env.JOB_NAME} - #${env.BUILD_NUMBER} ${env.STAGE_NAME} ${currentBuild.result}",
        body: """<p>${env.JOB_NAME} - #${env.BUILD_NUMBER} ${env.STAGE_NAME} ${currentBuild.result}</p><p>Check console <a href="${env.BUILD_URL}">output</a> to view the results.</p>""",
        recipientProviders: [[$class: 'CulpritsRecipientProvider'], [$class: 'DevelopersRecipientProvider']]
}
