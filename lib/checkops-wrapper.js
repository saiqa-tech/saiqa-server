/**
 * CheckOps Wrapper - Bridge between CommonJS (saiqa-server) and ES Modules (CheckOps)
 * All methods verified against CheckOps v3.0.0 codebase
 */

class CheckOpsWrapper {
    constructor() {
        this.checkops = null;
        this.initialized = false;
        this.config = null;
        this.productionMetrics = null;
        this.metricsCollector = null;
        this.metrics = {
            operations: 0,
            errors: 0,
            lastError: null,
            initTime: null
        };
    }

    async initialize(config = {}) {
        try {
            // ✅ VERIFIED: Dynamic import works for ES modules in CommonJS
            const CheckOpsModule = await import('@saiqa-tech/checkops');
            const CheckOps = CheckOpsModule.default;
            const { productionMetrics, metricsCollector } = CheckOpsModule;

            // Store monitoring references
            this.productionMetrics = productionMetrics;
            this.metricsCollector = metricsCollector;

            this.config = {
                host: config.host || process.env.DB_HOST,
                port: config.port || parseInt(process.env.DB_PORT),
                database: config.database || process.env.DB_NAME,
                user: config.user || process.env.DB_USER,
                password: config.password || process.env.DB_PASSWORD,

                // Enhanced v3.0.0 settings
                max: config.max || parseInt(process.env.CHECKOPS_POOL_MAX || '40'),
                min: config.min || parseInt(process.env.CHECKOPS_POOL_MIN || '5'),
                ssl: config.ssl || (process.env.DB_SSL === 'true')
            };

            this.checkops = new CheckOps(this.config);
            await this.checkops.initialize();

            // Initialize monitoring if enabled
            if (process.env.NODE_ENV === 'production' && process.env.CHECKOPS_MONITORING_ENABLED === 'true') {
                const interval = parseInt(process.env.CHECKOPS_MONITORING_INTERVAL || '60000');
                this.productionMetrics.startMonitoring(interval);
            }

            this.initialized = true;
            this.metrics.initTime = new Date();

            console.log('CheckOps wrapper initialized successfully');
            return true;
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            console.error('CheckOps initialization failed:', error);
            throw error;
        }
    }

    // ===================================================================
    // FORM MANAGEMENT METHODS (✅ VERIFIED against FormService.js)
    // ===================================================================

    async createForm(formData) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.createForm(formData);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getForm(formId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getForm(formId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getAllForms(options = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getAllForms(options);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async updateForm(formId, updates) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.updateForm(formId, updates);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async deleteForm(formId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.deleteForm(formId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async deactivateForm(formId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.deactivateForm(formId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async activateForm(formId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.activateForm(formId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getFormCount(options = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getFormCount(options);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }


    // ===================================================================
    // QUESTION MANAGEMENT METHODS (✅ VERIFIED against QuestionService.js)
    // ===================================================================

    async createQuestion(questionData) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.createQuestion(questionData);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getQuestion(questionId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getQuestion(questionId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getQuestions(ids) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getQuestions(ids);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getAllQuestions(options = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getAllQuestions(options);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async updateQuestion(questionId, updates) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.updateQuestion(questionId, updates);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async deleteQuestion(questionId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.deleteQuestion(questionId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async deactivateQuestion(questionId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.deactivateQuestion(questionId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async activateQuestion(questionId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.activateQuestion(questionId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getQuestionCount(options = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getQuestionCount(options);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    // ===================================================================
    // SUBMISSION MANAGEMENT METHODS (✅ VERIFIED against SubmissionService.js)
    // ===================================================================

    async createSubmission(submissionData) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.createSubmission(submissionData);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getSubmission(submissionId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getSubmission(submissionId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getSubmissionsByForm(formId, options = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getSubmissionsByForm(formId, options);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getAllSubmissions(options = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getAllSubmissions(options);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async updateSubmission(submissionId, updates) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.updateSubmission(submissionId, updates);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async deleteSubmission(submissionId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.deleteSubmission(submissionId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getSubmissionCount(options = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getSubmissionCount(options);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getSubmissionStats(formId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getSubmissionStats(formId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    // ===================================================================
    // CACHE MANAGEMENT METHODS (✅ NEW in v3.x)
    // ===================================================================

    async getCacheStats() {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getCacheStats();
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async clearCache() {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.clearCache();
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    // ===================================================================
    // OPTION MANAGEMENT METHODS (✅ VERIFIED against QuestionService.js)
    // ===================================================================

    async updateOptionLabel(questionId, optionKey, newLabel, changedBy) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.updateOptionLabel(questionId, optionKey, newLabel, changedBy);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getOptionHistory(questionId, optionKey) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getOptionHistory(questionId, optionKey);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    // ===================================================================
    // FINDING MANAGEMENT METHODS (✅ NEW in v4.0.0)
    // ===================================================================

    async createFinding(findingData) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.createFinding(findingData);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getFinding(findingId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getFinding(findingId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getFindingsByForm(formId, options = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getFindingsByForm(formId, options);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getFindingsBySubmission(submissionId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getFindingsBySubmission(submissionId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getFindingsByQuestion(questionId, options = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getFindingsByQuestion(questionId, options);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getFindings(filters = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getFindings(filters);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async updateFinding(findingId, updates) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.updateFinding(findingId, updates);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async deleteFinding(findingId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.deleteFinding(findingId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getFindingCount(filters = {}) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getFindingCount(filters);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    async getFindingsStats(formId) {
        this._ensureInitialized();
        try {
            this.metrics.operations++;
            return await this.checkops.getFindingsStats(formId);
        } catch (error) {
            this.metrics.errors++;
            this.metrics.lastError = error;
            throw error;
        }
    }

    // ===================================================================
    // MONITORING & HEALTH METHODS (✅ VERIFIED against productionMetrics.js)
    // ===================================================================

    getMetrics() {
        return {
            ...this.metrics,
            initialized: this.initialized,
            config: this.config ? { ...this.config, password: '[HIDDEN]' } : null
        };
    }

    getProductionMetrics() {
        // v3.1.0: productionMetrics is an object with properties, not methods
        if (!this.productionMetrics) return null;

        return {
            alerts: this.productionMetrics.alerts || [],
            alertThresholds: this.productionMetrics.alertThresholds || {},
            isMonitoring: this.productionMetrics.isMonitoring || false,
            metricsHistory: this.productionMetrics.metricsHistory || [],
            maxHistorySize: this.productionMetrics.maxHistorySize || 0
        };
    }

    getMetricsCollector() {
        // v3.1.0: metricsCollector is an object with properties
        if (!this.metricsCollector) return null;

        return {
            metrics: this.metricsCollector.metrics || {},
            startTime: this.metricsCollector.startTime || null,
            maxOperationsHistory: this.metricsCollector.maxOperationsHistory || 0
        };
    }

    getHealthCheckData() {
        // v3.1.0: Construct health check from available data
        if (!this.initialized) {
            return { status: 'uninitialized', healthy: false };
        }

        const collectorData = this.getMetricsCollector();
        const productionData = this.getProductionMetrics();

        return {
            status: 'healthy',
            healthy: true,
            initialized: this.initialized,
            uptime: this.metrics.initTime ? Date.now() - this.metrics.initTime.getTime() : 0,
            operations: this.metrics.operations,
            errors: this.metrics.errors,
            errorRate: this.metrics.operations > 0 ? (this.metrics.errors / this.metrics.operations) : 0,
            monitoring: productionData?.isMonitoring || false,
            collector: collectorData
        };
    }

    async getHealthStatus() {
        return this.getHealthCheckData();
    }

    async close() {
        if (this.checkops && typeof this.checkops.close === 'function') {
            await this.checkops.close();
        }

        if (this.productionMetrics && this.productionMetrics.stopMonitoring) {
            this.productionMetrics.stopMonitoring();
        }

        this.initialized = false;
    }

    _ensureInitialized() {
        if (!this.initialized) {
            throw new Error('CheckOps wrapper not initialized. Call initialize() first.');
        }
    }
}

// Singleton instance
let wrapperInstance = null;

function getCheckOpsWrapper() {
    if (!wrapperInstance) {
        wrapperInstance = new CheckOpsWrapper();
    }
    return wrapperInstance;
}

module.exports = {
    CheckOpsWrapper,
    getCheckOpsWrapper
};
